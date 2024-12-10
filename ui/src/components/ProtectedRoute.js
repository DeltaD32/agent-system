import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import AuthService from '../services/AuthService';

function ProtectedRoute({ component: Component, ...rest }) {
  return (
    <Route
      {...rest}
      render={props =>
        AuthService.isAuthenticated() ? (
          <Component {...props} />
        ) : (
          <Redirect
            to={{
              pathname: "/login",
              state: { from: props.location }
            }}
          />
        )
      }
    />
  );
}

export default ProtectedRoute; 