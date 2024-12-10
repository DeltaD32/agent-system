FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Add wait-for-it script
ADD https://raw.githubusercontent.com/vishnubob/wait-for-it/master/wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Create entrypoint script
RUN echo '#!/bin/bash\n\
/wait-for-it.sh database:5432 -- python init_db.py\n\
python app.py' > /entrypoint.sh && chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"] 