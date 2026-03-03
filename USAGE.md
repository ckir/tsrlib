# SDK Usage Examples

This document provides comprehensive usage examples for the ckir/tsrlib SDK, covering initialization, logging, market data retrieval, HTTP client usage, and configuration management.

## 1. SDK Initialization
To initialize the SDK, use the following code:
```javascript
const SDK = require('tsrlib');

const sdk = new SDK({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
});
```

## 2. Logging
To enable logging, you can set the logging level during initialization:
```javascript
const sdk = new SDK({
    apiKey: 'YOUR_API_KEY',
    apiSecret: 'YOUR_API_SECRET',
    logLevel: 'DEBUG',  // Possible values: DEBUG, INFO, WARN, ERROR
});
```

## 3. Market Data Retrieval
To retrieve market data, use the following example:
```javascript
const marketData = await sdk.getMarketData('BTC/USD');
console.log(marketData);
```

## 4. HTTP Client
For custom HTTP requests, use the HTTP client provided by the SDK:
```javascript
const response = await sdk.httpClient.get('/path/to/resource');
console.log(response.data);
```

## 5. Configuration Management
To manage configuration settings, you can use:
```javascript
sdk.config.set('key', 'value');
const value = sdk.config.get('key');
```