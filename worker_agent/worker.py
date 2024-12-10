import os
import json
import pika
import psycopg2
from prometheus_client import start_http_server, Counter
import ollama
import time
import uuid

# Prometheus metrics
TASKS_PROCESSED = Counter('tasks_processed_total', 'Total number of tasks processed')
TASKS_FAILED = Counter('tasks_failed_total', 'Total number of tasks that failed')

# Generate a unique ID for this worker
WORKER_ID = str(uuid.uuid4())

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.environ['DB_HOST'],
        database=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )

# Initialize Ollama client
ollama_client = ollama.Client()

def process_task(task_data):
    """Process a task using Mistral"""
    try:
        # Extract task information
        task_id = task_data['task_id']
        description = task_data['description']
        project_id = task_data['project_id']
        
        # Use Mistral to process the task
        prompt = f"Execute this task and provide the result:\nTask: {description}"
        response = ollama_client.generate(model="mistral", prompt=prompt)
        
        # Update task status in database
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            'UPDATE tasks SET status = %s, assigned_agent = %s WHERE id = %s',
            ('completed', WORKER_ID, task_id)
        )
        
        # Check if all tasks for the project are completed
        cur.execute('''
            SELECT COUNT(*) 
            FROM tasks 
            WHERE project_id = %s AND status != 'completed'
        ''', (project_id,))
        
        remaining_tasks = cur.fetchone()[0]
        
        if remaining_tasks == 0:
            # Update project status to completed
            cur.execute(
                'UPDATE projects SET status = %s WHERE id = %s',
                ('completed', project_id)
            )
        
        conn.commit()
        cur.close()
        conn.close()
        
        TASKS_PROCESSED.inc()
        return True
        
    except Exception as e:
        print(f"Error processing task: {str(e)}")
        TASKS_FAILED.inc()
        return False

def callback(ch, method, properties, body):
    """Callback function for processing messages from RabbitMQ"""
    task_data = json.loads(body)
    
    if process_task(task_data):
        ch.basic_ack(delivery_tag=method.delivery_tag)
    else:
        # Requeue the message if processing failed
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    # Start Prometheus metrics server
    start_http_server(8000)
    
    # Connect to RabbitMQ
    credentials = pika.PlainCredentials(
        os.environ['RABBITMQ_USER'],
        os.environ['RABBITMQ_PASS']
    )
    
    while True:
        try:
            connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=os.environ['RABBITMQ_HOST'],
                    credentials=credentials
                )
            )
            channel = connection.channel()
            
            # Declare queue
            channel.queue_declare(queue='task_queue', durable=True)
            
            # Set up consumer
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(
                queue='task_queue',
                on_message_callback=callback
            )
            
            print(f" [*] Worker {WORKER_ID} waiting for tasks. To exit press CTRL+C")
            channel.start_consuming()
            
        except pika.exceptions.AMQPConnectionError:
            print("Lost connection to RabbitMQ. Retrying in 5 seconds...")
            time.sleep(5)
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            time.sleep(5)

if __name__ == '__main__':
    main() 