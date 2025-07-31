import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface ScraperConfig {
  headless?: boolean;
  timeout?: number;
  screenshotDir?: string;
}

interface ScrapingOptions {
  waitTime?: number;
  waitForSelector?: string;
  scrollToBottom?: boolean;
  takeScreenshot?: boolean;
  screenshotName?: string;
  extractForms?: boolean;
  extractLinks?: boolean;
  clickApplyButton?: boolean;
  sendFormHTMLOnly?: boolean;
  extractFormInputs?: boolean;
  detectConditionalInputs?: boolean;
  outputDir?: string;
  includeFullHtml?: boolean;
}

interface FormInput {
  inputType: string;
  inputLabel: string;
  id: string | undefined;
  hidden: boolean;
  conditional?: boolean;
  iteration?: number;
  triggeredBy?: string;
  options?: Array<{ value: string; text: string }>;
}

interface ScrapedData {
  url: string;
  html?: string;
  formInputs?: FormInput[];
  timestamp: string;
  extractedData: {
    forms?: any[];
    links?: any[];
  };
  pageTitle: string;
  pageUrl: string;
  isFormHTML?: boolean;
  isFormInputs?: boolean;
}

interface ProcessResult {
  success: boolean;
  scrapedData?: ScrapedData;
  error?: string;
}

class JobApplicationScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: ScraperConfig;

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: process.env.HEADLESS === 'true' || false,
      timeout: parseInt(process.env.TIMEOUT || '30000'),
      screenshotDir: './screenshots',
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('Launching browser...');
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await this.page.setViewport({ width: 1920, height: 1080 });

      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async handleCookiePopup(): Promise<boolean> {
    try {
      console.log('Checking for cookie popup...');
      
      await this.page!.waitForTimeout(2000);

      const frames = this.page!.frames();
      console.log(`Found ${frames.length} frames on the page`);
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log(`Checking frame ${i}: ${frame.url()}`);
        
        try {
          const cookieSelectors = [
            '[data-testid="accept-all-cookies"]',
            '[data-testid="cookie-accept-all"]',
            '.cookie-accept-all',
            '.accept-all-cookies',
            '#accept-all-cookies',
            '#cookie-accept-all',
            '[data-testid="accept-cookies"]',
            '[data-testid="cookie-accept"]',
            '.cookie-accept',
            '.accept-cookies',
            '#accept-cookies',
            '#cookie-accept',
            'button:has-text("Accept")',
            'button:has-text("Accept All")',
            'button:has-text("Accept Cookies")',
            'button:has-text("I Accept")',
            'button:has-text("OK")',
            'button:has-text("Got it")',
            'button:has-text("I Agree")',
            '.cookie-banner button',
            '.cookie-notice button',
            '.cookie-popup button',
            '.gdpr-banner button',
            '.privacy-banner button',
            '.cookie-consent button',
            '.cookie-modal button'
          ];

          for (const selector of cookieSelectors) {
            try {
              const element = await frame.$(selector);
              if (element) {
                console.log(`Found cookie popup in frame ${i} with selector: ${selector}`);
                await element.click();
                console.log('Cookie popup accepted');
                await this.page!.waitForTimeout(1000);
                return true;
              }
            } catch (error) {
              continue;
            }
          }

          const acceptButtons = await frame.$$eval('button', (buttons: Element[]) => {
            return buttons
              .filter((button: Element) => {
                const text = (button as HTMLElement).textContent?.toLowerCase() || '';
                return text.includes('accept') || 
                       text.includes('ok') || 
                       text.includes('got it') || 
                       text.includes('i agree') ||
                       text.includes('allow all') ||
                       text.includes('accept all');
              })
              .map((button: Element, index: number) => ({ 
                text: (button as HTMLElement).textContent || '', 
                index 
              }));
          });

          if (acceptButtons.length > 0) {
            console.log(`Found accept buttons in frame ${i} by text:`, acceptButtons);
            await frame.evaluate((buttonText: string) => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const button = buttons.find(btn => (btn as HTMLElement).textContent?.toLowerCase().includes(buttonText.toLowerCase()));
              if (button) {
                (button as HTMLElement).click();
                return true;
              }
              return false;
            }, acceptButtons[0].text);
            console.log('Cookie popup accepted by text');
            await this.page!.waitForTimeout(1000);
            return true;
          }

        } catch (error) {
          console.log(`Error checking frame ${i}:`, (error as Error).message);
          continue;
        }
      }

      const cookieSelectors = [
        '[data-testid="accept-all-cookies"]',
        '[data-testid="cookie-accept-all"]',
        '.cookie-accept-all',
        '.accept-all-cookies',
        '#accept-all-cookies',
        '#cookie-accept-all',
        '[data-testid="accept-cookies"]',
        '[data-testid="cookie-accept"]',
        '.cookie-accept',
        '.accept-cookies',
        '#accept-cookies',
        '#cookie-accept',
        'button:has-text("Accept")',
        'button:has-text("Accept All")',
        'button:has-text("Accept Cookies")',
        'button:has-text("I Accept")',
        'button:has-text("OK")',
        'button:has-text("Got it")',
        'button:has-text("I Agree")',
        '.cookie-banner button',
        '.cookie-notice button',
        '.cookie-popup button',
        '.gdpr-banner button',
        '.privacy-banner button',
        '.cookie-consent button',
        '.cookie-modal button'
      ];

      for (const selector of cookieSelectors) {
        try {
          const element = await this.page!.$(selector);
          if (element) {
            console.log(`Found cookie popup on main page with selector: ${selector}`);
            await element.click();
            console.log('Cookie popup accepted');
            await this.page!.waitForTimeout(1000);
            return true;
          }
        } catch (error) {
          continue;
        }
      }

      const acceptButtons = await this.page!.$$eval('button', (buttons: Element[]) => {
        return buttons
          .filter((button: Element) => {
            const text = (button as HTMLElement).textContent?.toLowerCase() || '';
            return text.includes('accept') || 
                   text.includes('ok') || 
                   text.includes('got it') || 
                   text.includes('i agree') ||
                   text.includes('allow all') ||
                   text.includes('accept all');
          })
          .map((button: Element, index: number) => ({ 
            text: (button as HTMLElement).textContent || '', 
            index 
          }));
      });

      if (acceptButtons.length > 0) {
        console.log('Found accept buttons on main page by text:', acceptButtons);
        await this.page!.evaluate((buttonText: string) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const button = buttons.find(btn => (btn as HTMLElement).textContent?.toLowerCase().includes(buttonText.toLowerCase()));
          if (button) {
            (button as HTMLElement).click();
            return true;
          }
          return false;
        }, acceptButtons[0].text);
        console.log('Cookie popup accepted by text');
        await this.page!.waitForTimeout(1000);
        return true;
      }

      console.log('No cookie popup found or already accepted');
      return false;
    } catch (error) {
      console.log('Error handling cookie popup:', (error as Error).message);
      return false;
    }
  }

  async clickApplyButton(): Promise<boolean> {
    try {
      console.log('Looking for Apply button...');
      
      await this.page!.waitForTimeout(2000);
      
      const alternativeSelectors = [
        'input[value="Apply"]',
        'input[value="Apply Now"]',
        'input[value="Apply Here"]',
        '.ui-button[value="Apply"]',
        '.ui-button[value="Apply Now"]',
        '.ui-button[value="Apply Here"]',
        'input[type="submit"][value="Apply"]',
        'input[type="submit"][value="Apply Now"]',
        'input[type="submit"][value="Apply Here"]',
        'a[href*="apply"]',
        'a:contains("Apply")',
        'div[onclick*="apply"]',
        'div[class*="apply"]',
        'div[class*="button"]:contains("Apply")',
        '.apply-button',
        '.apply-now-button',
        '.apply-here-button'
      ];
      
      for (const selector of alternativeSelectors) {
        try {
          const button = await this.page!.$('selector');
          if (button) {
            console.log(`Found Apply button with selector: ${selector}`);
            await button.click();
            console.log('Apply button clicked');
            return true;
          }
        } catch (error) {
          continue;
        }
      }
      
      const applyButtons = await this.page!.$$eval('input[type="submit"], button, a, div[onclick], div[class*="button"], div[class*="apply"]', (elements: Element[]) => {
        return elements
          .filter((el: Element) => {
            // For divs, check that they don't contain interactive elements
            if ((el as HTMLElement).tagName === 'DIV') {
              const hasInteractiveElements = el.querySelector('a, button, input, select, textarea');
              if (hasInteractiveElements) {
                return false; // Skip divs that contain interactive elements
              }
            }
            
            const value = (el as HTMLInputElement).value || (el as HTMLElement).textContent || '';
            const href = (el as HTMLAnchorElement).href || '';
            const className = (el as HTMLElement).className || '';
            const onclick = (el as HTMLElement).getAttribute('onclick') || '';
            
            return value.toLowerCase().includes('apply') || 
                   href.toLowerCase().includes('apply') ||
                   className.toLowerCase().includes('apply') ||
                   onclick.toLowerCase().includes('apply');
          })
          .map((el: Element) => ({
            value: (el as HTMLInputElement).value || (el as HTMLElement).textContent || '',
            id: (el as HTMLElement).id,
            name: (el as HTMLInputElement).name,
            className: (el as HTMLElement).className,
            tagName: (el as HTMLElement).tagName,
            href: (el as HTMLAnchorElement).href || ''
          }));
      });
      
      if (applyButtons.length > 0) {
        console.log('Found Apply buttons by text:', applyButtons);
        // Use a more reliable approach to click the button
        await this.page!.evaluate((buttonValue) => {
          const buttons = Array.from(document.querySelectorAll('input[type="submit"], button, a, div[onclick], div[class*="button"], div[class*="apply"]'));
          const button = buttons.find(btn => {
            // For divs, check that they don't contain interactive elements
            if ((btn as HTMLElement).tagName === 'DIV') {
              const hasInteractiveElements = btn.querySelector('a, button, input, select, textarea');
              if (hasInteractiveElements) {
                return false; // Skip divs that contain interactive elements
              }
            }
            
            const value = (btn as HTMLInputElement).value || (btn as HTMLElement).textContent || '';
            const href = (btn as HTMLAnchorElement).href || '';
            const className = (btn as HTMLElement).className || '';
            const onclick = (btn as HTMLElement).getAttribute('onclick') || '';
            
            return value.toLowerCase().includes(buttonValue.toLowerCase()) || 
                   href.toLowerCase().includes(buttonValue.toLowerCase()) ||
                   className.toLowerCase().includes(buttonValue.toLowerCase()) ||
                   onclick.toLowerCase().includes(buttonValue.toLowerCase());
          });
          if (button) {
            (button as HTMLElement).click();
            return true;
          }
          return false;
        }, applyButtons[0].value);
        console.log('Apply button clicked by text');
        return true;
      }
      
      console.log('No Apply button found');
      return false;
    } catch (error) {
      console.error('Error clicking Apply button:', error);
      return false;
    }
  }

  async extractFormHTML(): Promise<string | null> {
    try {
      console.log('Extracting form HTML...');
      
      const formHTML = await this.page!.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form'));
        if (forms.length === 0) {
          return null;
        }
        
        const cleanForm = (form: Element, stripValues = true) => {
          const cleanedForm = form.cloneNode(true) as Element;
          
          if (stripValues) {
            const inputs = cleanedForm.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
              if (input.hasAttribute('value')) {
                input.removeAttribute('value');
              }
              
              if ((input as HTMLInputElement).value) {
                (input as HTMLInputElement).value = '';
              }
            });
          }
          
          const scripts = cleanedForm.querySelectorAll('script');
          scripts.forEach(script => {
            script.remove();
          });
          
          return cleanedForm;
        };
        
        if (forms.length === 1) {
          return cleanForm(forms[0], true).outerHTML;
        } else {
          const container = document.createElement('div');
          container.className = 'extracted-forms';
          forms.forEach(form => {
            const formWrapper = document.createElement('div');
            formWrapper.className = 'form-wrapper';
            formWrapper.appendChild(cleanForm(form, true));
            container.appendChild(formWrapper);
          });
          return container.outerHTML;
        }
      });
      
      if (formHTML) {
        console.log('Form HTML extracted successfully (values and scripts stripped)');
        return formHTML;
      } else {
        console.log('No forms found on the page');
        return null;
      }
    } catch (error) {
      console.error('Failed to extract form HTML:', error);
      return null;
    }
  }

  async fillInputsWithDummyData(): Promise<void> {
    try {
      console.log('Filling inputs with dummy data...');
      
      await this.page!.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('form input, form textarea, form select'));
        
        inputs.forEach(input => {
          if ((input as HTMLInputElement).type === 'hidden' || 
              (input as HTMLInputElement).type === 'file' ||
              (input as HTMLElement).style.display === 'none' || 
              (input as HTMLElement).style.visibility === 'hidden' ||
              input.hasAttribute('hidden') ||
              window.getComputedStyle(input as Element).display === 'none' ||
              window.getComputedStyle(input as Element).visibility === 'hidden') {
            return;
          }
          
          switch ((input as HTMLInputElement).type) {
            case 'text':
            case 'email':
              (input as HTMLInputElement).value = 'test@example.com';
              break;
            case 'tel':
              (input as HTMLInputElement).value = '+1234567890';
              break;
            case 'number':
              (input as HTMLInputElement).value = '42';
              break;
            case 'date':
              (input as HTMLInputElement).value = '2024-01-01';
              break;
            case 'url':
              (input as HTMLInputElement).value = 'https://example.com';
              break;
            case 'password':
              (input as HTMLInputElement).value = 'testpassword123';
              break;
            case 'checkbox':
              (input as HTMLInputElement).checked = true;
              break;
            case 'radio':
              if ((input as HTMLInputElement).name) {
                const radios = document.querySelectorAll(`input[name="${(input as HTMLInputElement).name}"]`);
                if (radios[0] === input) {
                  (input as HTMLInputElement).checked = true;
                }
              }
              break;
            default:
              (input as HTMLInputElement).value = 'test';
          }
          
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        });
        
        const textareas = Array.from(document.querySelectorAll('form textarea'));
        textareas.forEach(textarea => {
          (textarea as HTMLTextAreaElement).value = 'This is a test textarea content for form validation.';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          textarea.dispatchEvent(new Event('blur', { bubbles: true }));
        });
        
        const selects = Array.from(document.querySelectorAll('form select'));
        selects.forEach(select => {
          if ((select as HTMLSelectElement).options.length > 0) {
            (select as HTMLSelectElement).selectedIndex = 1;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
      
      console.log('Inputs filled with dummy data');
      
      await this.page!.waitForTimeout(2000);
      
    } catch (error) {
      console.error('Failed to fill inputs with dummy data:', error);
    }
  }

  async extractFormInputsWithConditional(): Promise<FormInput[]> {
    try {
      console.log('Extracting form inputs with iterative conditional detection...');
      
      console.log('First pass: Extracting initial inputs...');
      const initialInputs = await this.extractFormInputs();
      let allInputs = [...initialInputs];
      let iteration = 1;
      let newInputsFound = true;
      const maxIterations = 5; // Prevent infinite loops
      
      while (newInputsFound && iteration <= maxIterations) {
        console.log(`\nIteration ${iteration}: Filling inputs and detecting new ones...`);
        
        await this.fillInputsWithDummyData();
        
        const currentInputs = await this.extractFormInputs();
        
        const newInputs = this.findNewInputs(allInputs, currentInputs);
        
        if (newInputs.length > 0) {
          console.log(`Found ${newInputs.length} new conditional inputs in iteration ${iteration}`);
          
          // Log the new inputs for debugging
          newInputs.forEach((input, index) => {
            console.log(`  New input ${index + 1}: ${input.inputLabel} (${input.inputType}) - ID: ${input.id}`);
          });
          
          newInputs.forEach(input => {
            input.conditional = true;
            input.iteration = iteration;
          });
          
          allInputs = [...allInputs, ...newInputs];
          iteration++;
        } else {
          console.log(`No new inputs found in iteration ${iteration}, stopping`);
          newInputsFound = false;
        }
      }
      
      if (iteration > maxIterations) {
        console.log(`\n⚠️  Reached maximum iterations (${maxIterations}), stopping to prevent infinite loop`);
      }
      
      console.log('\nHandling multiple choice inputs with 4 or fewer options...');
      const multipleChoiceInputs = allInputs.filter(input => 
        input.inputType === 'radio' || 
        (input.inputType === 'select' && input.options && input.options.length <= 4)
      );
      
      for (const input of multipleChoiceInputs) {
        await this.tryAllMultipleChoiceOptions(input, allInputs);
      }
      
      console.log(`\nFinal result: ${allInputs.length} total inputs (${allInputs.filter(i => i.conditional).length} conditional)`);
      return allInputs;
      
    } catch (error) {
      console.error('Failed to extract form inputs with conditional detection:', error);
      return [];
    }
  }

  async tryAllMultipleChoiceOptions(input: FormInput, allInputs: FormInput[]): Promise<void> {
    try {
      console.log(`Trying all options for: ${input.inputLabel} (${input.inputType})`);
      
      if (input.inputType === 'radio') {
        await this.tryAllRadioOptions(input, allInputs);
      } else if (input.inputType === 'select') {
        await this.tryAllSelectOptions(input, allInputs);
      }
    } catch (error) {
      console.error(`Failed to try all options for ${input.inputLabel}:`, error);
    }
  }

  async tryAllRadioOptions(input: FormInput, allInputs: FormInput[]): Promise<void> {
    try {
      const radioOptions = await this.page!.evaluate((inputId: string) => {
        const radios = Array.from(document.querySelectorAll(`input[name="${inputId}"]`));
        return radios.map((radio, index) => ({
          index,
          value: (radio as HTMLInputElement).value,
          text: (radio.nextElementSibling as HTMLElement)?.textContent?.trim() || (radio as HTMLInputElement).value
        }));
      }, input.id!);
      
      if (radioOptions.length <= 4) {
        console.log(`  Radio group has ${radioOptions.length} options, trying each...`);
        
        for (let i = 0; i < radioOptions.length; i++) {
          console.log(`    Trying option ${i + 1}: ${radioOptions[i].text}`);
          
          await this.page!.evaluate((inputId: string, optionIndex: number) => {
            const radios = Array.from(document.querySelectorAll(`input[name="${inputId}"]`));
            if (radios[optionIndex]) {
              (radios[optionIndex] as HTMLInputElement).checked = true;
              (radios[optionIndex] as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, input.id!, i);
          
          await this.page!.waitForTimeout(1000);
          
          const currentInputs = await this.extractFormInputs();
          const newInputs = this.findNewInputs(allInputs, currentInputs);
          
          if (newInputs.length > 0) {
            console.log(`      Found ${newInputs.length} new inputs for this option`);
            newInputs.forEach(newInput => {
              newInput.conditional = true;
              newInput.triggeredBy = `${input.inputLabel} = ${radioOptions[i].text}`;
            });
            allInputs.push(...newInputs);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to try radio options for ${input.inputLabel}:`, error);
    }
  }

  async tryAllSelectOptions(input: FormInput, allInputs: FormInput[]): Promise<void> {
    try {
      const selectOptions = await this.page!.evaluate((inputId: string) => {
        const select = document.getElementById(inputId) as HTMLSelectElement;
        if (!select) return [];
        
        return Array.from(select.options).map((option, index) => ({
          index,
          value: option.value,
          text: option.textContent?.trim() || ''
        }));
      }, input.id!);
      
      if (selectOptions.length <= 4) {
        console.log(`  Select has ${selectOptions.length} options, trying each...`);
        
        for (let i = 0; i < selectOptions.length; i++) {
          console.log(`    Trying option ${i + 1}: ${selectOptions[i].text}`);
          
          await this.page!.evaluate((inputId: string, optionIndex: number) => {
            const select = document.getElementById(inputId) as HTMLSelectElement;
            if (select && select.options[optionIndex]) {
              select.selectedIndex = optionIndex;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, input.id!, i);
          
          await this.page!.waitForTimeout(1000);
          
          const currentInputs = await this.extractFormInputs();
          const newInputs = this.findNewInputs(allInputs, currentInputs);
          
          if (newInputs.length > 0) {
            console.log(`      Found ${newInputs.length} new inputs for this option`);
            newInputs.forEach(newInput => {
              newInput.conditional = true;
              newInput.triggeredBy = `${input.inputLabel} = ${selectOptions[i].text}`;
            });
            allInputs.push(...newInputs);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to try select options for ${input.inputLabel}:`, error);
    }
  }

  findNewInputs(existingInputs: FormInput[], currentInputs: FormInput[]): FormInput[] {
    const existingKeys = new Set(existingInputs.map(input => this.createInputKey(input)));
    
    const newInputs = currentInputs.filter(input => {
      const key = this.createInputKey(input);
      const isNew = !existingKeys.has(key);
      
      // Additional check: don't add inputs with the same label and type
      const hasSameLabelAndType = existingInputs.some(existing => 
        existing.inputLabel.trim().toLowerCase() === input.inputLabel.trim().toLowerCase() &&
        existing.inputType === input.inputType
      );
      
      if (isNew && !hasSameLabelAndType) {
        console.log(`    Detected new input: ${input.inputLabel} (${input.inputType}) - Key: ${key}`);
      } else if (isNew && hasSameLabelAndType) {
        console.log(`    Skipping duplicate input: ${input.inputLabel} (${input.inputType}) - same label/type exists`);
      }
      
      return isNew && !hasSameLabelAndType;
    });
    
    console.log(`    Comparing ${existingInputs.length} existing vs ${currentInputs.length} current inputs`);
    console.log(`    Found ${newInputs.length} truly new inputs`);
    
    return newInputs;
  }

  createInputKey(input: FormInput): string {
    // Create a more stable key that doesn't rely on changing IDs
    const label = input.inputLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const type = input.inputType.toLowerCase();
    
    // Only include ID if it's a stable one (not auto-generated)
    const id = input.id && !input.id.includes('input') && !input.id.includes('tel-input') 
      ? input.id.toLowerCase().replace(/[^a-z0-9]/g, '_') 
      : '';
    
    // Use label and type as primary identifiers, ID as secondary
    return id ? `${type}_${label}_${id}` : `${type}_${label}`;
  }

  async extractFormInputs(): Promise<FormInput[]> {
    try {
      console.log('Extracting form inputs with labels...');
      
      const formInputs = await this.page!.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('form input, form textarea, form select'));
        
        return inputs.map(input => {
          let inputLabel = '';
          
          if ((input as HTMLElement).id) {
            const label = document.querySelector(`label[for="${(input as HTMLElement).id}"]`);
            if (label) {
              inputLabel = (label as HTMLElement).textContent?.trim() || '';
            }
          }
          
          if (!inputLabel) {
            const parentLabel = input.closest('label');
            if (parentLabel) {
              inputLabel = (parentLabel as HTMLElement).textContent?.trim() || '';
            }
          }
          
          if (!inputLabel) {
            let sibling = input.previousElementSibling;
            while (sibling && !inputLabel) {
              if (sibling.tagName === 'LABEL') {
                inputLabel = (sibling as HTMLElement).textContent?.trim() || '';
                break;
              }
              if ((sibling as HTMLElement).textContent?.trim()) {
                inputLabel = (sibling as HTMLElement).textContent?.trim() || '';
                break;
              }
              sibling = sibling.previousElementSibling;
            }
            
            if (!inputLabel && input.parentElement) {
              sibling = input.parentElement.previousElementSibling;
              while (sibling && !inputLabel) {
                if (sibling.tagName === 'LABEL') {
                  inputLabel = (sibling as HTMLElement).textContent?.trim() || '';
                  break;
                }
                if ((sibling as HTMLElement).textContent?.trim()) {
                  inputLabel = (sibling as HTMLElement).textContent?.trim() || '';
                  break;
                }
                sibling = sibling.previousElementSibling;
              }
            }
          }
          
          if (!inputLabel) {
            inputLabel = (input as HTMLInputElement).placeholder || input.getAttribute('aria-label') || '';
          }
          
          let inputType = (input as HTMLInputElement).type || 'text';
          if (input.tagName === 'TEXTAREA') {
            inputType = 'textarea';
          } else if (input.tagName === 'SELECT') {
            inputType = 'select';
          }
          
          const isHidden = (input as HTMLInputElement).type === 'hidden' || 
                          (input as HTMLElement).style.display === 'none' || 
                          (input as HTMLElement).style.visibility === 'hidden' ||
                          input.hasAttribute('hidden') ||
                          window.getComputedStyle(input as Element).display === 'none' ||
                          window.getComputedStyle(input as Element).visibility === 'hidden';
          
          let options = null;
          if (input.tagName === 'SELECT') {
            options = Array.from((input as HTMLSelectElement).options).map(option => ({
              value: option.value,
              text: option.textContent?.trim() || ''
            }));
          }
          
          return {
            inputType: inputType,
            inputLabel: inputLabel,
            id: (input as HTMLElement).id || undefined,
            hidden: isHidden,
            options: options || undefined
          };
        }).filter(input => !input.hidden);
      });
      
      if (formInputs.length > 0) {
        console.log(`Form inputs extracted successfully: ${formInputs.length} inputs found`);
        return formInputs;
      } else {
        console.log('No form inputs found on the page');
        return [];
      }
    } catch (error) {
      console.error('Failed to extract form inputs:', error);
      return [];
    }
  }

  async scrapeJobPage(url: string, options: ScrapingOptions = {}): Promise<ScrapedData> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const defaultOptions: ScrapingOptions = {
      waitTime: 3000,
      waitForSelector: undefined,
      scrollToBottom: false,
      takeScreenshot: false,
      screenshotName: undefined,
      extractForms: false,
      extractLinks: false,
      clickApplyButton: false,
      sendFormHTMLOnly: true,
      extractFormInputs: true,
      detectConditionalInputs: true,
      ...options
    };

    try {
      console.log(`Navigating to: ${url}`);
      
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      await this.handleCookiePopup();

      if (defaultOptions.clickApplyButton) {
        await this.clickApplyButton();
      }

      if (defaultOptions.waitTime) {
        console.log(`Waiting for ${defaultOptions.waitTime}ms...`);
        await this.page.waitForTimeout(defaultOptions.waitTime);
      }

      if (defaultOptions.waitForSelector) {
        console.log(`Waiting for selector: ${defaultOptions.waitForSelector}`);
        try {
          await this.page.waitForSelector(defaultOptions.waitForSelector, { timeout: 10000 });
        } catch (error) {
          console.log(`Selector ${defaultOptions.waitForSelector} not found, continuing...`);
        }
      }

      if (defaultOptions.scrollToBottom) {
        console.log('Scrolling to bottom to load dynamic content...');
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.page.waitForTimeout(2000);
      }

      let html: string | undefined = undefined;
      let formInputs: FormInput[] | undefined = undefined;
      
      if (defaultOptions.extractFormInputs) {
        if (defaultOptions.detectConditionalInputs) {
          formInputs = await this.extractFormInputsWithConditional();
        } else {
          formInputs = await this.extractFormInputs();
        }
        console.log('Form inputs extracted successfully');
      } else if (defaultOptions.sendFormHTMLOnly) {
        html = await this.extractFormHTML() || undefined;
        if (!html) {
          html = await this.page.content();
          console.log('No forms found, using full page HTML');
        }
      } else {
        html = await this.page.content();
      }
      
      console.log('Data harvested successfully');

      let extractedData: { forms?: any[]; links?: any[] } = {};
      if (defaultOptions.extractForms) {
        extractedData.forms = await this.extractForms();
      }
      if (defaultOptions.extractLinks) {
        extractedData.links = await this.extractLinks();
      }

      return {
        url,
        html,
        formInputs,
        timestamp: new Date().toISOString(),
        extractedData,
        pageTitle: await this.page.title(),
        pageUrl: this.page.url(),
        isFormHTML: defaultOptions.sendFormHTMLOnly && html !== undefined,
        isFormInputs: defaultOptions.extractFormInputs && formInputs !== undefined
      };

    } catch (error) {
      console.error(`Failed to scrape page ${url}:`, error);
      throw error;
    }
  }

  async extractForms(): Promise<any[]> {
    try {
      return await this.page!.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form'));
        return forms.map((form, index) => ({
          id: (form as HTMLElement).id || `form-${index}`,
          action: (form as HTMLFormElement).action,
          method: (form as HTMLFormElement).method,
          inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
            type: (input as HTMLInputElement).type,
            name: (input as HTMLInputElement).name,
            id: (input as HTMLElement).id,
            placeholder: (input as HTMLInputElement).placeholder,
            required: (input as HTMLInputElement).required,
            hasValue: (input as HTMLInputElement).value && (input as HTMLInputElement).value.trim() !== '',
            valueLength: (input as HTMLInputElement).value ? (input as HTMLInputElement).value.length : 0
          }))
        }));
      });
    } catch (error) {
      console.error('Failed to extract forms:', error);
      return [];
    }
  }

  async extractLinks(): Promise<any[]> {
    try {
      return await this.page!.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links.map(link => ({
          text: (link as HTMLElement).textContent?.trim() || '',
          href: (link as HTMLAnchorElement).href,
          title: (link as HTMLAnchorElement).title
        }));
      });
    } catch (error) {
      console.error('Failed to extract links:', error);
      return [];
    }
  }

  async processJobApplication(url: string, options: ScrapingOptions = {}): Promise<ProcessResult> {
    try {
      const scrapedData = await this.scrapeJobPage(url, options);
      
      await this.saveResponseToFile(url, scrapedData, options);
      
      return {
        success: true,
        scrapedData
      };
    } catch (error) {
      console.error('Failed to process job application:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  async saveResponseToFile(url: string, scrapedData: ScrapedData, options: ScrapingOptions = {}): Promise<string | null> {
    try {
      const outputDir = options.outputDir || './output';
      await fs.mkdir(outputDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const urlSlug = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `response_${urlSlug}_${timestamp}.json`;
      const filepath = path.join(outputDir, filename);
      
      const outputData = {
        pageTitle: scrapedData.pageTitle,
        timestamp: scrapedData.timestamp,
        inputs: scrapedData.formInputs,
      };
      
      await fs.writeFile(filepath, JSON.stringify(outputData, null, 2));
      console.log(`Result saved to: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error('Failed to save response to file:', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

export default JobApplicationScraper; 
