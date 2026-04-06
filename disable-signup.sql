ALTER ROLE authenticator SET request.jwt.claims TO '';
-- Disable signup via config if available, otherwise handle in app
-- The primary protection is: no signup endpoint + RLS requiring authenticated role
SELECT 1;
