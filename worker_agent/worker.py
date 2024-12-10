import os
import json
import pika
import psycopg2
from prometheus_client import start_http_server, Counter, Gauge
import ollama
import time
import uuid
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
TASKS_PROCESSED = Counter('tasks_processed_total', 'Total number of tasks processed')
TASKS_FAILED = Counter('tasks_failed_total', 'Total number of tasks that failed')
TASK_PROCESSING_TIME = Gauge('task_processing_time_seconds', 'Time taken to process tasks')
AGENT_STATUS = Gauge('agent_status', 'Current status of the agent (0=offline, 1=available, 2=busy)')

# Generate a unique ID for this worker
WORKER_ID = str(uuid.uuid4())

# Initialize Ollama client
ollama_client = ollama.Client()

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'database'),
        database=os.environ.get('DB_NAME', 'project_db'),
        user=os.environ.get('DB_USER', 'projectuser'),
        password=os.environ.get('DB_PASSWORD', 'projectpass')
    )

def register_agent():
    """Register this agent in the database"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            '''
            INSERT INTO worker_agents (name, status, capabilities, last_heartbeat)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (name) DO UPDATE
            SET status = EXCLUDED.status,
                last_heartbeat = EXCLUDED.last_heartbeat
            RETURNING id
            ''',
            (WORKER_ID, 'available', json.dumps(['mistral']))
        )
        
        agent_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"Agent {WORKER_ID} registered with ID {agent_id}")
        AGENT_STATUS.set(1)  # Set status to available
        return agent_id
        
    except Exception as e:
        logger.error(f"Error registering agent: {str(e)}")
        raise e

def update_heartbeat():
    """Update agent's last heartbeat timestamp"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            'UPDATE worker_agents SET last_heartbeat = NOW() WHERE name = %s',
            (WORKER_ID,)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error updating heartbeat: {str(e)}")

def process_task(task_data):
    """Process a task using Mistral"""
    try:
        # Extract task information
        task_id = task_data['task_id']
        description = task_data['description']
        
        logger.info(f"Processing task {task_id}: {description}")
        start_time = time.time()
        
        # Update task status to processing
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            'UPDATE tasks SET status = %s WHERE id = %s',
            ('processing', task_id)
        )
        conn.commit()
        
        # Use Mistral to process the task
        prompt = f"Execute this task and provide the result:\nTask: {description}"
        response = ollama_client.generate(model="mistral", prompt=prompt)
        
        # Update task with results
        cur.execute(
            '''
            UPDATE tasks 
            SET status = %s,
                completion_percentage = 100,
                metadata = jsonb_set(
                    metadata,
                    '{result}',
                    %s::jsonb
                )
            WHERE id = %s
            ''',
            ('completed', json.dumps(response['response']), task_id)
        )
        
        # Update agent status to available
        cur.execute(
            'UPDATE worker_agents SET status = %s WHERE name = %s',
            ('available', WORKER_ID)
        )
        
        conn.commit()
        cur.close()
        conn.close()
        
        # Update metrics
        TASKS_PROCESSED.inc()
        processing_time = time.time() - start_time
        TASK_PROCESSING_TIME.set(processing_time)
        AGENT_STATUS.set(1)  # Set status back to available
        
        logger.info(f"Task {task_id} completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error processing task: {str(e)}")
        TASKS_FAILED.inc()
        AGENT_STATUS.set(1)  # Set status back to available
        
        try:
            # Update task status to failed
            conn = get_db_connection()
            cur = conn.cursor()
            
            cur.execute(
                '''
                UPDATE tasks 
                SET status = %s,
                    metadata = jsonb_set(
                        metadata,
                        '{error}',
                        %s::jsonb
                    )
                WHERE id = %s
                ''',
                ('failed', json.dumps(str(e)), task_id)
            )
            
            # Update agent status to available
            cur.execute(
                'UPDATE worker_agents SET status = %s WHERE name = %s',
                ('available', WORKER_ID)
            )
            
            conn.commit()
            cur.close()
            conn.close()
            
        except Exception as db_error:
            logger.error(f"Error updating task status: {str(db_error)}")
        
        return False

def callback(ch, method, properties, body):
    """Callback function for processing messages from RabbitMQ"""
    task_data = json.loads(body)
    logger.info(f"Received task: {task_data}")
    
    AGENT_STATUS.set(2)  # Set status to busy
    
    if process_task(task_data):
        ch.basic_ack(delivery_tag=method.delivery_tag)
    else:
        # Requeue the message if processing failed
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    """Main function to run the worker agent"""
    try:
        # Start Prometheus metrics server
        start_http_server(8000)
        
        # Register agent
        agent_id = register_agent()
        
        # Set up heartbeat timer
        last_heartbeat = time.time()
        
        # Connect to RabbitMQ
        credentials = pika.PlainCredentials(
            os.environ.get('RABBITMQ_USER', 'guest'),
            os.environ.get('RABBITMQ_PASS', 'guest')
        )
        
        while True:
            try:
                connection = pika.BlockingConnection(
                    pika.ConnectionParameters(
                        host=os.environ.get('RABBITMQ_HOST', 'message_queue'),
                        credentials=credentials
                    )
                )
                channel = connection.channel()
                
                # Declare queue
                queue_name = f'agent_{agent_id}'
                channel.queue_declare(queue=queue_name, durable=True)
                
                # Set up consumer
                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(
                    queue=queue_name,
                    on_message_callback=callback
                )
                
                logger.info(f"Worker {WORKER_ID} waiting for tasks. To exit press CTRL+C")
                
                # Start consuming in a separate thread
                import threading
                consumer_thread = threading.Thread(target=channel.start_consuming)
                consumer_thread.daemon = True
                consumer_thread.start()
                
                # Main loop for heartbeat
                while True:
                    current_time = time.time()
                    if current_time - last_heartbeat >= 30:  # Send heartbeat every 30 seconds
                        update_heartbeat()
                        last_heartbeat = current_time
                    time.sleep(1)
                
            except pika.exceptions.AMQPConnectionError:
                logger.error("Lost connection to RabbitMQ. Retrying in 5 seconds...")
                time.sleep(5)
            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}")
                time.sleep(5)
    
    except KeyboardInterrupt:
        logger.info("Shutting down worker agent...")
        AGENT_STATUS.set(0)  # Set status to offline
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                'UPDATE worker_agents SET status = %s WHERE name = %s',
                ('offline', WORKER_ID)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            logger.error(f"Error updating agent status: {str(e)}")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        AGENT_STATUS.set(0)  # Set status to offline

if __name__ == '__main__':
    main() 