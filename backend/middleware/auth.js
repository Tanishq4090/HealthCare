import { supabase } from '../services/supabase.js';

/**
 * Strict JWT Verification Middleware
 * Validates the Authorization header using Supabase Auth.
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('[Auth Middleware] Unauthorized access attempt:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    // Attach verified user instance to the request
    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth Middleware] Internal error:', err.message);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
}
