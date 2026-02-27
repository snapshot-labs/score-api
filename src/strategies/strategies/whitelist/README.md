# Whitelist

Gives VP of 1 to addresses in the whitelist, 0 otherwise.

Addresses can be provided inline or fetched from a URL.

### Inline addresses

```json
{
  "symbol": "POINT",
  "addresses": ["0xabc...", "0xdef..."]
}
```

### Remote URL

The URL should return a JSON with an `addresses` array.

```json
{
  "symbol": "POINT",
  "url": "https://example.com/whitelist.json"
}
```

Expected JSON format at the URL:

```json
{
  "addresses": ["0xabc...", "0xdef..."]
}
```
