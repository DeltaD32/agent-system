import os
import jwt
from functools import wraps
from flask import request, jsonify
from datetime import datetime, timedelta

# JWT configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

def create_jwt_token(username):
    """Create a JWT token for the given username"""
    payload = {
        'username': username,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def token_required(f):
    """Decorator to protect routes with JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Token is missing'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            # Verify token
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            current_user = data['username']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token is invalid'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def require_auth(f):
    """Legacy decorator for basic auth - keeping for backward compatibility"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated