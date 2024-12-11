import os
import jwt
from functools import wraps
from quart import request, Response
import json
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

def require_auth(f):
    """Decorator to protect routes with JWT token"""
    @wraps(f)
    async def decorated(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers.get('Authorization')
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return Response(
                    response=json.dumps({'error': 'Token is missing'}),
                    status=401,
                    mimetype='application/json'
                )
        
        if not token:
            return Response(
                response=json.dumps({'error': 'Authentication required'}),
                status=401,
                mimetype='application/json'
            )
        
        try:
            # Verify token
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.current_user = data['username']
            return await f(*args, **kwargs)
        except jwt.ExpiredSignatureError:
            return Response(
                response=json.dumps({'error': 'Token has expired'}),
                status=401,
                mimetype='application/json'
            )
        except jwt.InvalidTokenError:
            return Response(
                response=json.dumps({'error': 'Token is invalid'}),
                status=401,
                mimetype='application/json'
            )
    
    return decorated

def token_required(f):
    """Legacy decorator for token auth - keeping for backward compatibility"""
    return require_auth(f)