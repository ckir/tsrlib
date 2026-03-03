# SDK Usage Examples

## Initialization

To initialize the SDK, use the following code:
```javascript
const sdk = require('tsrlib');
const instance = sdk.initialize({
    apiKey: 'YOUR_API_KEY',
    environment: 'production'
});
```

## Logging

The SDK provides built-in logging functionality. You can configure and use it as follows:
```javascript
const logger = sdk.getLogger();
logger.setLevel('DEBUG');
logger.info('SDK initialized successfully');
```

## Market Data Retrieval

To retrieve market data, use the following function:
```javascript
instance.marketData.fetch({
    symbol: 'AAPL'
}).then(data => {
    console.log('Market Data:', data);
}).catch(error => {
    logger.error('Error fetching market data:', error);
});
```

## HTTP Client Usage

Make API calls using the SDK's HTTP client:
```javascript
instance.httpClient.get('/api/v1/resource')
    .then(response => {
        console.log('Response:', response.data);
    })
    .catch(error => {
        logger.error('Error making API call:', error);
    });
```

## Configuration Management

You can manage configurations like this:
```javascript
instance.config.set('timeout', 5000);
const timeout = instance.config.get('timeout');
console.log('Timeout set to:', timeout);
```

## Error Handling

Proper error handling is crucial. Use try-catch blocks:
```javascript
try {
    const data = await instance.marketData.fetch({ symbol: 'TSLA' });
    console.log(data);
} catch (error) {
    logger.error('Fetching data failed:', error.message);
}
```

## Real-World Scenarios

Here’s a complete example combining several features:
```javascript
async function main() {
    try {
        const instance = sdk.initialize({ apiKey: 'YOUR_API_KEY' });
        logger.info('SDK initialized');

        const marketData = await instance.marketData.fetch({ symbol: 'GOOGL' });
        console.log('Market data for GOOGL:', marketData);
    } catch (error) {
        logger.error('An error occurred:', error.message);
    }
}

main();
```