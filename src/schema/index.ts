export interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  screenshotDir?: string;
}

export interface ScrapingOptions {
  waitTime?: number;
  waitForSelector?: string;
  scrollToBottom?: boolean;
  clickApplyButton?: boolean;
  outputDir?: string;
}

export interface FormInput {
  inputType: string;
  inputLabel: string;
  id: string | undefined;
  hidden: boolean;
  conditional?: boolean;
  iteration?: number;
  triggeredBy?: string;
  options?: Array<{ value: string; text: string }>;
}

export interface ScrapedData {
  url: string;
  html?: string;
  formInputs?: FormInput[];
  timestamp: string;
  pageTitle: string;
  pageUrl: string;
  isFormHTML?: boolean;
  isFormInputs?: boolean;
}

export interface ProcessResult {
  success: boolean;
  scrapedData?: ScrapedData;
  error?: string;
}
