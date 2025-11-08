# JSON Cell Preview Examples

## Real-World Examples

### Example 1: User Metadata

**In Table:**
```
{"id": "user_123", "name": "Alice Johnson", "roles": ["admin…
```

**In Dialog:**
```
{
  "id": "user_123",
  "name": "Alice Johnson",
  "roles": [
    "admin",
    "editor",
    "viewer"
  ],
  "preferences": {
    "theme": "dark",
    "notifications": true,
    "language": "en"
  },
  "created_at": "2024-01-15T10:30:00Z",
  "last_login": "2024-11-08T14:22:15Z"
}
```

### Example 2: Array of Objects

**In Table:**
```
[{"id": "prod_001", "name": "Widget", "price": 19.99}, {…
```

**In Dialog:**
```
[
  {
    "id": "prod_001",
    "name": "Widget A",
    "price": 19.99,
    "in_stock": true,
    "categories": [
      "electronics",
      "gadgets"
    ]
  },
  {
    "id": "prod_002",
    "name": "Widget B",
    "price": 29.99,
    "in_stock": false,
    "categories": [
      "electronics",
      "premium"
    ]
  }
]
```

### Example 3: Nested Configuration

**In Table:**
```
{"server": {"host": "localhost", "port": 3000, "ssl": tru…
```

**In Dialog:**
```
{
  "server": {
    "host": "localhost",
    "port": 3000,
    "ssl": true,
    "timeout": 30000,
    "keepAlive": true
  },
  "database": {
    "name": "mydb",
    "connection": {
      "pool": {
        "min": 2,
        "max": 10
      },
      "retry": {
        "attempts": 3,
        "delay": 1000
      }
    }
  },
  "features": {
    "caching": true,
    "compression": true,
    "monitoring": {
      "enabled": true,
      "interval": 60000
    }
  }
}
```

## Truncation Examples

### Short JSON (no truncation):
```
{"active": true, "count": 42}
```

### Medium JSON (truncated):
```
{"firstName": "John", "lastName": "Doe", "email": "john…
```

### Long JSON (truncated):
```
{"id": "uuid-1234-5678-90ab-cdefghijklmn", "timestamp": "20…
```

## Preview Length

The preview is limited to **60 characters** plus ellipsis:

- Very short objects/arrays display completely
- Medium content shows key information
- Long content truncates with "…" indicator
- Full content visible on hover (tooltip)
- Full content in dialog (90vh height)

## Whitespace Handling

**Original (with whitespace):**
```json
{
  "name": "John",
  "age": 30,
  "active":   true
}
```

**Preview (normalized):**
```
{"name": "John", "age": 30, "active": true}
```

All extra whitespace is removed for compact display.
