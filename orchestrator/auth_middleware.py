from functools import wraps
from flask import request, jsonify
import jwt
import os
from datetime import datetime, timedelta

SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key')

def create_service_tokens(user_data):
    """Create tokens for different services"""
    return {
        'grafana': create_grafana_token(user_data),
        'prometheus': create_prometheus_token(user_data),
        'rabbitmq': create_rabbitmq_token(user_data)
    }

def create_jwt_token(user_data):
    """Create JWT token for main authentication"""
    payload = {
        'user_id': user_data['id'],
        'username': user_data['username'],
        'exp': datetime.utcnow() + timedelta(days=1)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            current_user = data
        except:
            return jsonify({'message': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated 