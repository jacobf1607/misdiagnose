#!/bin/sh

# Entrypoint script for Railway with persistent volume
# The volume mounts OVER /app/dist/data, so on first deploy it's empty
#
# CRITICAL: User data (users.json) is NEVER overwritten from backup
# Only cases and other non-user data is initialized from backup

DATA_DIR="/app/dist/data"
BACKUP_DIR="/app/data-init"
USERS_DIR="$DATA_DIR/users"
USERS_FILE="$USERS_DIR/users.json"

# Ensure data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo "[Entrypoint] Creating data directory..."
    mkdir -p $DATA_DIR
fi

# Ensure users directory exists (but NEVER overwrite users.json)
if [ ! -d "$USERS_DIR" ]; then
    echo "[Entrypoint] Creating users directory..."
    mkdir -p $USERS_DIR
fi

# If users.json doesn't exist, create an empty one (don't copy from backup!)
if [ ! -f "$USERS_FILE" ]; then
    echo "[Entrypoint] Creating empty users.json (user data is sacred, never overwritten)"
    echo '{"users":{}}' > $USERS_FILE
fi

# Initialize cases directory from backup if it doesn't exist
if [ ! -d "$DATA_DIR/cases" ]; then
    echo "[Entrypoint] Initializing cases from backup..."
    if [ -d "$BACKUP_DIR/cases" ]; then
        cp -r $BACKUP_DIR/cases $DATA_DIR/
        echo "[Entrypoint] Cases initialized successfully"
    else
        echo "[Entrypoint] Warning: No cases backup found, creating empty directory"
        mkdir -p $DATA_DIR/cases
    fi
else
    echo "[Entrypoint] Cases directory exists, using existing data"
fi

# Initialize other data directories if they don't exist (analytics, pending, etc.)
for subdir in analytics pending; do
    if [ ! -d "$DATA_DIR/$subdir" ]; then
        echo "[Entrypoint] Creating $subdir directory..."
        mkdir -p "$DATA_DIR/$subdir"
    fi
done

# Initialize other data files if they don't exist (but never overwrite)
for file in challenges.json notifications.json feedback.json; do
    if [ ! -f "$DATA_DIR/$file" ]; then
        if [ -f "$BACKUP_DIR/$file" ]; then
            echo "[Entrypoint] Initializing $file from backup..."
            cp "$BACKUP_DIR/$file" "$DATA_DIR/$file"
        else
            echo "[Entrypoint] Creating empty $file..."
            echo '{}' > "$DATA_DIR/$file"
        fi
    fi
done

# REFRESH_CASES=true will update cases from backup while keeping user data
if [ "$REFRESH_CASES" = "true" ]; then
    echo "[Entrypoint] REFRESH_CASES=true, updating cases folder..."
    if [ -d "$BACKUP_DIR/cases" ]; then
        rm -rf $DATA_DIR/cases
        cp -r $BACKUP_DIR/cases $DATA_DIR/
        echo "[Entrypoint] Cases refreshed from backup (user data preserved)"
    else
        echo "[Entrypoint] Warning: No cases backup found at $BACKUP_DIR/cases"
    fi
fi

# Log data directory status
echo "[Entrypoint] Data directory status:"
echo "  - Users: $(cat $USERS_FILE | grep -o '"uid"' | wc -l) users"
echo "  - Cases: $(ls $DATA_DIR/cases/*.json 2>/dev/null | wc -l) case files"

# Start the server
echo "[Entrypoint] Starting server..."
exec npm start
