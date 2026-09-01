<?php
// Vercel PHP entrypoint. Requires a PostgreSQL DATABASE_URL environment variable.
require_once __DIR__ . '/../src/bootstrap.php';
require_once __DIR__ . '/../src/router.php';
