# Job Application Scraper Service

A Node.js service that uses Puppeteer to interact with job application pages, harvest HTML content, and send it to a specified API endpoint.

## Features

- **Web Scraping**: Visit job application pages and extract HTML content
- **Cookie Popup Handling**: Automatically detect and accept cookie popups (including iframe-based ones)
- **Form Interaction**: Fill and submit forms automatically
- **Screenshot Capture**: Take screenshots of pages for debugging
- **API Integration**: Send harvested data to your specified API endpoint
- **Configurable Options**: Customize wait times, selectors, and behavior
- **Error Handling**: Robust error handling and logging
- **Anti-Detection**: User agent spoofing and request interception

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd auto-form-test
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Set up environment variables:
```bash
cp env.example .env
```

Edit the `.env` file with your configuration:
```env
# API Configuration
API_ENDPOINT=http://localhost:3000/api/html
API_KEY=your_api_key_here

# Job Application URL (optional - can be passed as parameter)
JOB_URL=https://example.com/job-application

# Browser Configuration
HEADLESS=false
TIMEOUT=30000
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

### Advanced Usage with All Features

```typescript
import JobApplicationScraper from './dist/scraper-service.js';

async function advancedScraping(): Promise<void> {
  const scraper = new JobApplicationScraper({
    screenshotDir: './screenshots',
    headless: false
  });
  
  try {
    await scraper.initialize();
    
    const result = await scraper.processJobApplication('https://example.com/job-application', {
      waitTime: 5000,
      waitForSelector: '.application-form',
      scrollToBottom: true,
      takeScreenshot: true,
      screenshotName: 'job-application.png',
      extractForms: true,
      extractLinks: true
    });
    
    // Fill a form if found
    if (result.success && result.scrapedData?.extractedData.forms?.length) {
      await scraper.fillForm('#application-form', {
        'first-name': 'John',
        'last-name': 'Doe',
        'email': 'john.doe@example.com'
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}
```

## API Reference

### JobApplicationScraper Class

#### Constructor
```javascript
new JobApplicationScraper(config)
```

**Config options:**
- `headless` (boolean): Run browser in headless mode
- `timeout` (number): Request timeout in milliseconds
- `screenshotDir` (string): Directory for screenshots

#### Methods

##### `initialize()`
Initializes the browser and page instance.

##### `handleCookiePopup()`
Automatically detects and accepts cookie popups, including those in iframes.

##### `scrapeJobPage(url, options)`
Scrapes a job application page.

**Parameters:**
- `url` (string): The URL to scrape
- `options` (object): Configuration options
  - `waitTime` (number): Time to wait after page load (ms)
  - `waitForSelector` (string): CSS selector to wait for
  - `scrollToBottom` (boolean): Whether to scroll to bottom
  - `screenshotName` (string): Screenshot filename
  - `extractForms` (boolean): Extract form information
  - `extractLinks` (boolean): Extract link information

**Returns:** Object containing scraped data

##### `extractForms()`
Extracts form information from the page.

##### `extractLinks()`
Extracts link information from the page.

##### `fillForm(formSelector, data)`
Fills a form with provided data.

##### `submitForm(formSelector)`
Submits a form.

##### `processJobApplication(url, options)`
Complete workflow: scrape page and send to API.

##### `close()`
Closes the browser instance.

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JOB_URL` | Default job application URL | None |
| `HEADLESS` | Run browser in headless mode | `false` |
| `TIMEOUT` | Request timeout (ms) | `30000` |

### Scraping Options

| Option | Type | Description |
|--------|------|-------------|
| `waitTime` | number | Time to wait after page load (ms) |
| `waitForSelector` | string | CSS selector to wait for |
| `scrollToBottom` | boolean | Scroll to bottom of page |
| `takeScreenshot` | boolean | Take screenshot |
| `screenshotName` | string | Screenshot filename |
| `extractForms` | boolean | Extract form information |
| `extractLinks` | boolean | Extract link information |
| `outputDir` | string | Directory to save JSON response files |
| `includeFullHtml` | boolean | Include full HTML in JSON output file |
| `clickApplyButton` | boolean | Click Apply button after cookie popup |
| `sendFormHTMLOnly` | boolean | Send only form HTML to API (default: true) |
| `extractFormInputs` | boolean | Extract structured input data (default: true) |
| `detectConditionalInputs` | boolean | Detect conditional inputs with two-pass approach (default: true) |

## Examples

Run the example scripts:

```bash
# Build the TypeScript code
npm run build

# Run examples
node dist/examples/basic-usage.js

# Or run the main service
npm start
```

## Form HTML Extraction

The service can extract and send only form HTML to your API, making it much more efficient:

- **Default behavior**: Extracts only form HTML (much smaller payload)
- **Fallback**: If no forms found, sends full page HTML
- **Multiple forms**: If multiple forms exist, extracts all of them
- **Configurable**: Can be disabled to send full page HTML
- **Value stripping**: Automatically removes pre-filled values from inputs
- **Script removal**: Removes all `<script>` elements for cleaner data

### Form HTML Structure

When `sendFormHTMLOnly: true` (default):
- Single form: Returns the form's outerHTML
- Multiple forms: Returns all forms wrapped in a container div
- **Clean data**: All `value` attributes are stripped from inputs
- **No pre-filled data**: Form inputs are returned empty for clean processing
- **No scripts**: All `<script>` elements are removed for security and cleanliness

## Form Input Extraction

The service can extract structured form input data, making it much more efficient and easier to process:

- **Default behavior**: Extracts structured input data with labels
- **Fallback**: If no forms found, sends full page HTML
- **Smart label detection**: Uses multiple methods to find input labels
- **Clean data structure**: Returns exactly what you need for form processing

### Input Data Schema

Each input is extracted with this structure:

```json
{
  "inputType": "text|number|date|textarea|select|email|password|...",
  "inputLabel": "The label text associated with this input",
  "id": "input-id-or-null",
  "hidden": true|false,
  "conditional": true|false
}
```

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

### Enhanced Data Schema

Each input now includes additional metadata:

```json
{
  "inputType": "text|number|date|textarea|select|email|password|...",
  "inputLabel": "The label text associated with this input",
  "id": "input-id-or-null",
  "hidden": true|false,
  "conditional": true|false,
  "iteration": 2,
  "triggeredBy": "Employment Status = Full-time",
  "options": [
    { "value": "option1", "text": "Option 1" },
    { "value": "option2", "text": "Option 2" }
  ]
}
```

### Dummy Data Strategy

The service fills inputs with appropriate dummy data:

- **Text/Email**: `test@example.com`
- **Phone**: `+1234567890`
- **Number**: `42`
- **Date**: `2024-01-01`
- **URL**: `https://example.com`
- **Password**: `testpassword123`
- **Checkbox**: `true`
- **Radio**: First option in group
- **Textarea**: Sample text content
- **Select**: Second option (skips "Please select")

### Label Detection Methods

The service uses multiple methods to find input labels:

1. **Explicit association**: `<label for="input-id">Label</label>`
2. **Wrapped labels**: `<label><input>Label</label>`
3. **Nearby text**: Text elements near the input
4. **Placeholder/aria-label**: Fallback to accessibility attributes

### Example Output

```json
[
  {
    "inputType": "text",
    "inputLabel": "First Name",
    "id": "firstName",
    "hidden": false,
    "conditional": false
  },
  {
    "inputType": "email",
    "inputLabel": "Email Address",
    "id": "email",
    "hidden": false,
    "conditional": false
  },
  {
    "inputType": "text",
    "inputLabel": "Company Name",
    "id": "company",
    "hidden": false,
    "conditional": true,
    "iteration": 2,
    "triggeredBy": "Employment Status = Full-time"
  },
  {
    "inputType": "text",
    "inputLabel": "University Name",
    "id": "university",
    "hidden": false,
    "conditional": true,
    "iteration": 3,
    "triggeredBy": "Education Level = University"
  },
  {
    "inputType": "hidden",
    "inputLabel": "",
    "id": "sessionId",
    "hidden": true,
    "conditional": false
  }
]
```

## JSON Output Files

The service automatically saves API responses to JSON files with the following structure:

```json
{
  "metadata": {
    "url": "https://example.com/job-application",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "scraperVersion": "1.0.0",
    "options": { ... }
  },
  "scrapedData": {
    "url": "https://example.com/job-application",
    "pageTitle": "Job Application",
    "pageUrl": "https://example.com/job-application",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "userAgent": "Mozilla/5.0...",
    "screenshot": "/path/to/screenshot.png",
    "htmlLength": 45000,
    "isFormHTML": true,
    "extractedData": {
      "forms": [...],
      "links": [...]
    }
  },
  "apiResponse": { ... }
}
```

**File naming convention**: `response_{url_slug}_{timestamp}.json`

**Output directories**:
- Default: `./output/`
- Customizable via `outputDir` option
- Automatically created if they don't exist


## Error Handling

The service includes comprehensive error handling:

- Network timeouts
- Page load failures
- Browser initialization issues
- Form interaction errors
- Cookie popup handling errors

All errors are logged and returned in the result object.

## Troubleshooting

### Common Issues

1. **Browser fails to launch**: Ensure you have the necessary system dependencies
2. **Page timeout**: Increase the timeout value in configuration
4. **Form not found**: Verify the CSS selector is correct
5. **Cookie popup not accepted**: The service automatically handles most cookie popups, including iframe-based ones

### Debug Mode

Enable debug mode by setting `HEADLESS=false` in your environment variables to see the browser in action.

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request
