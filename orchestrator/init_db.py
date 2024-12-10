import os
import psycopg2
import logging
from glob import glob

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'database'),
        database=os.environ.get('DB_NAME', 'project_db'),
        user=os.environ.get('DB_USER', 'projectuser'),
        password=os.environ.get('DB_PASSWORD', 'projectpass')
    )

def init_db():
    """Initialize database with all migrations"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create migrations table if it doesn't exist
        cur.execute('''
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create updated_at trigger function
        cur.execute('''
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        ''')
        
        # Get all migration files
        migration_files = sorted(glob('migrations/*.sql'))
        
        # Apply each migration if not already applied
        for migration_file in migration_files:
            filename = os.path.basename(migration_file)
            
            # Check if migration was already applied
            cur.execute('SELECT 1 FROM migrations WHERE filename = %s', (filename,))
            if not cur.fetchone():
                logger.info(f"Applying migration: {filename}")
                
                # Read and execute migration
                with open(migration_file, 'r') as f:
                    migration_sql = f.read()
                    cur.execute(migration_sql)
                
                # Record migration
                cur.execute(
                    'INSERT INTO migrations (filename) VALUES (%s)',
                    (filename,)
                )
                
                conn.commit()
            else:
                logger.info(f"Migration already applied: {filename}")
        
        logger.info("Database initialized successfully")
        
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise e
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    init_db() 