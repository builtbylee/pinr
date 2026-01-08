# Network Troubleshooting for Firebase CLI

## Current Issue

Firebase CLI cannot authenticate because it cannot reach `https://auth.firebase.tools/attest`.

## Diagnosis Steps

### 1. Test Basic Connectivity

```bash
# Test DNS resolution
nslookup auth.firebase.tools

# Test ping
ping -c 3 auth.firebase.tools

# Test HTTPS connection
curl -v https://auth.firebase.tools/attest
```

### 2. Check Firewall/Proxy

```bash
# Check for proxy settings
env | grep -i proxy

# Check npm config
cat ~/.npmrc
```

### 3. Try Different Network

- Switch to mobile hotspot
- Try different WiFi network
- Use VPN if behind corporate firewall

## Solutions

### Solution 1: Fix Network Issue (Recommended)

If you're on a corporate network or behind a firewall:

1. **Try mobile hotspot:**
   - Disconnect from current WiFi
   - Connect to mobile hotspot
   - Run `firebase login` again

2. **Use VPN:**
   - Connect to VPN
   - Run `firebase login` again

3. **Check macOS Firewall:**
   - System Settings → Network → Firewall
   - Temporarily disable to test
   - If that works, add Firebase to allowed apps

### Solution 2: Use CI/CD Pipeline

Set up automated deployment via GitHub Actions or similar:

1. Store Firebase token as secret
2. Deploy on push to main branch
3. Bypasses local network issues

### Solution 3: Manual Workaround

If network issue persists, you can:

1. **Deploy from a different machine:**
   - Use a machine with working network
   - Copy `functions` directory
   - Deploy from there

2. **Use Google Cloud Console:**
   - More complex but possible
   - Requires gcloud CLI setup

## Next Steps

**Immediate:** Try mobile hotspot or VPN to test if it's a network issue.

If that works, we know it's a network/firewall problem and can work on a permanent solution.

