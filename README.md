# Job Application Scraper Service

status: very experimental, proof-of-concept.

---

A Node.js service that uses Puppeteer to interact with job application pages, harvest HTML content, and stores form data locally.

## Installation & running


```bash
npm install
```

Edit an `.env` file with your configuration:
```env
# Job Application URL (optional - can be passed as parameter as in `examples`.)
JOB_URL=https://example.com/job-application

# Browser Configuration
HEADLESS=false
TIMEOUT=30000
```

```bash
npm run build
node dist/examples/basic-usage.js (example run)
```

## Usage

### Basic Usage

```typescript
import JobApplicationScraper from './dist/scraper-service.js';

async function scrapeJobPage(): Promise<void> {
  const scraper = new JobApplicationScraper();
  
  try {
    await scraper.initialize();
    
    const result = await scraper.processJobApplication('https://example.com/job-application', {
      waitTime: 3000,
      scrollToBottom: true
    });
    
    console.log('Result:', result);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JOB_URL` | Default job application URL | None |
| `HEADLESS` | Run browser in headless mode | `false` |
| `TIMEOUT` | Request timeout (ms) | `30000` |


### Conditional Input Detection

The service can detect conditional inputs that only appear after the form is filled:

- **Iterative approach**: Repeatedly fills inputs and detects new ones until no more appear
- **Multiple choice handling**: For radio/select with 4 or fewer options, tries each option
- **Dynamic detection**: Re-extracts inputs after each iteration to find new ones
- **Smart identification**: Marks inputs as `conditional: true` if they only appear after filling
- **Event simulation**: Triggers proper events to activate dynamic form behavior
- **Comprehensive coverage**: Ensures all possible conditional inputs are discovered

### Iterative Process

1. **Initial extraction**: Get all visible inputs
2. **Fill and detect**: Fill inputs with dummy data, check for new inputs
3. **Repeat**: Continue until no new inputs appear
4. **Multiple choice**: For radio/select with ≤4 options, try each option
5. **Final collection**: All discovered inputs with metadata
