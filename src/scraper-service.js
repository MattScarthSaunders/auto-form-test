const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class JobApplicationScraper {
  constructor(config = {}) {
    this.browser = null;
    this.page = null;
    this.config = {
      apiEndpoint: process.env.API_ENDPOINT || 'http://localhost:3000/api/html',
      apiKey: process.env.API_KEY,
      headless: process.env.HEADLESS === 'true' || false,
      timeout: parseInt(process.env.TIMEOUT) || 30000,
      screenshotDir: './screenshots',
      ...config
    };
  }

  async initialize() {
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

  async handleCookiePopup() {
    try {
      console.log('Checking for cookie popup...');
      
      // Wait a bit for the popup to appear
      await this.page.waitForTimeout(2000);

      // First, check for iframes that might contain cookie popups
      const frames = this.page.frames();
      console.log(`Found ${frames.length} frames on the page`);
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log(`Checking frame ${i}: ${frame.url()}`);
        
        try {
          // Common cookie popup selectors
          const cookieSelectors = [
            // Accept all cookies button
            '[data-testid="accept-all-cookies"]',
            '[data-testid="cookie-accept-all"]',
            '.cookie-accept-all',
            '.accept-all-cookies',
            '#accept-all-cookies',
            '#cookie-accept-all',
            
            // Accept cookies button
            '[data-testid="accept-cookies"]',
            '[data-testid="cookie-accept"]',
            '.cookie-accept',
            '.accept-cookies',
            '#accept-cookies',
            '#cookie-accept',
            
            // Generic accept buttons
            'button:has-text("Accept")',
            'button:has-text("Accept All")',
            'button:has-text("Accept Cookies")',
            'button:has-text("I Accept")',
            'button:has-text("OK")',
            'button:has-text("Got it")',
            'button:has-text("I Agree")',
            
            // More specific selectors
            '.cookie-banner button',
            '.cookie-notice button',
            '.cookie-popup button',
            '.gdpr-banner button',
            '.privacy-banner button',
            
            // Barhale specific (if any)
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
                await this.page.waitForTimeout(1000); // Wait for popup to disappear
                return true;
              }
            } catch (error) {
              // Continue to next selector
              continue;
            }
          }

          // Try clicking by text content in the frame
          const acceptButtons = await frame.$$eval('button', buttons => {
            return buttons
              .filter(button => {
                const text = button.textContent.toLowerCase();
                return text.includes('accept') || 
                       text.includes('ok') || 
                       text.includes('got it') || 
                       text.includes('i agree') ||
                       text.includes('allow all') ||
                       text.includes('accept all');
              })
              .map((button, index) => ({ text: button.textContent, index }));
          });

          if (acceptButtons.length > 0) {
            console.log(`Found accept buttons in frame ${i} by text:`, acceptButtons);
            // Click the button directly using evaluate
            await frame.evaluate((buttonText) => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const button = buttons.find(btn => btn.textContent.toLowerCase().includes(buttonText.toLowerCase()));
              if (button) {
                button.click();
                return true;
              }
              return false;
            }, acceptButtons[0].text);
            console.log('Cookie popup accepted by text');
            await this.page.waitForTimeout(1000);
            return true;
          }

        } catch (error) {
          console.log(`Error checking frame ${i}:`, error.message);
          continue;
        }
      }

      // Also check the main page for cookie popups
      const cookieSelectors = [
        // Accept all cookies button
        '[data-testid="accept-all-cookies"]',
        '[data-testid="cookie-accept-all"]',
        '.cookie-accept-all',
        '.accept-all-cookies',
        '#accept-all-cookies',
        '#cookie-accept-all',
        
        // Accept cookies button
        '[data-testid="accept-cookies"]',
        '[data-testid="cookie-accept"]',
        '.cookie-accept',
        '.accept-cookies',
        '#accept-cookies',
        '#cookie-accept',
        
        // Generic accept buttons
        'button:has-text("Accept")',
        'button:has-text("Accept All")',
        'button:has-text("Accept Cookies")',
        'button:has-text("I Accept")',
        'button:has-text("OK")',
        'button:has-text("Got it")',
        'button:has-text("I Agree")',
        
        // More specific selectors
        '.cookie-banner button',
        '.cookie-notice button',
        '.cookie-popup button',
        '.gdpr-banner button',
        '.privacy-banner button',
        
        // Barhale specific (if any)
        '.cookie-consent button',
        '.cookie-modal button'
      ];

      for (const selector of cookieSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            console.log(`Found cookie popup on main page with selector: ${selector}`);
            await element.click();
            console.log('Cookie popup accepted');
            await this.page.waitForTimeout(1000); // Wait for popup to disappear
            return true;
          }
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }

      // Try clicking by text content on main page
      const acceptButtons = await this.page.$$eval('button', buttons => {
        return buttons
          .filter(button => {
            const text = button.textContent.toLowerCase();
            return text.includes('accept') || 
                   text.includes('ok') || 
                   text.includes('got it') || 
                   text.includes('i agree') ||
                   text.includes('allow all') ||
                   text.includes('accept all');
          })
          .map((button, index) => ({ text: button.textContent, index }));
      });

      if (acceptButtons.length > 0) {
        console.log('Found accept buttons on main page by text:', acceptButtons);
        // Click the button directly using evaluate
        await this.page.evaluate((buttonText) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const button = buttons.find(btn => btn.textContent.toLowerCase().includes(buttonText.toLowerCase()));
          if (button) {
            button.click();
            return true;
          }
          return false;
        }, acceptButtons[0].text);
        console.log('Cookie popup accepted by text');
        await this.page.waitForTimeout(1000);
        return true;
      }

      console.log('No cookie popup found or already accepted');
      return false;
    } catch (error) {
      console.log('Error handling cookie popup:', error.message);
      return false;
    }
  }

  async clickApplyButton() {
    try {
      console.log('Looking for Apply button...');
      
      // Wait a bit for the page to be fully loaded after cookie popup
      await this.page.waitForTimeout(2000);
      
      // Try the specific selector first
      const applyButton = await this.page.$('#MainPlaceholder_Info_ApplyNowButton1');
      if (applyButton) {
        console.log('Found Apply button with specific ID');
        await applyButton.click();
        console.log('Apply button clicked');
        return true;
      }
      
      // Try alternative selectors
      const alternativeSelectors = [
        'input[name="ctl01$MainPlaceholder$Info$ApplyNowButton1"]',
        'input[value="Apply"]',
        '.AdvortoApplyNowButton',
        '.ui-button[value="Apply"]',
        'input[type="submit"][value="Apply"]'
      ];
      
      for (const selector of alternativeSelectors) {
        try {
          const button = await this.page.$(selector);
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
      
      // Try finding by text content
      const applyButtons = await this.page.$$eval('input[type="submit"], button', elements => {
        return elements
          .filter(el => {
            const value = el.value || el.textContent || '';
            return value.toLowerCase().includes('apply');
          })
          .map(el => ({
            value: el.value || el.textContent,
            id: el.id,
            name: el.name,
            className: el.className
          }));
      });
      
      if (applyButtons.length > 0) {
        console.log('Found Apply buttons by text:', applyButtons);
        // Click the first apply button found
        await this.page.click(`input[value="${applyButtons[0].value}"], button:has-text("${applyButtons[0].value}")`);
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

  async extractFormHTML() {
    try {
      console.log('Extracting form HTML...');
      
      const formHTML = await this.page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form'));
        if (forms.length === 0) {
          return null;
        }
        
        // Function to clean form by removing value attributes and scripts
        const cleanForm = (form, stripValues = true) => {
          const cleanedForm = form.cloneNode(true);
          
          if (stripValues) {
            // Remove value attributes from all input elements
            const inputs = cleanedForm.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
              if (input.hasAttribute('value')) {
                input.removeAttribute('value');
              }
              
              // Also clear the actual value property
              if (input.value) {
                input.value = '';
              }
            });
          }
          
          // Remove all script elements from the form
          const scripts = cleanedForm.querySelectorAll('script');
          scripts.forEach(script => {
            script.remove();
          });
          
          return cleanedForm;
        };
        
        // Return the first form's HTML, or all forms if multiple exist
        if (forms.length === 1) {
          return cleanForm(forms[0], true).outerHTML;
        } else {
          // If multiple forms, return them all wrapped in a container
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

  async extractFormInputs() {
    try {
      console.log('Extracting form inputs with labels...');
      
      const formInputs = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('form input, form textarea, form select'));
        
        return inputs.map(input => {
          // Get the label associated with this input
          let inputLabel = '';
          
          // Method 1: Check for explicit label association via 'for' attribute
          if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) {
              inputLabel = label.textContent.trim();
            }
          }
          
          // Method 2: Check if input is inside a label element
          if (!inputLabel) {
            const parentLabel = input.closest('label');
            if (parentLabel) {
              inputLabel = parentLabel.textContent.trim();
            }
          }
          
          // Method 3: Look for nearby label or text
          if (!inputLabel) {
            // Check previous sibling
            let sibling = input.previousElementSibling;
            while (sibling && !inputLabel) {
              if (sibling.tagName === 'LABEL') {
                inputLabel = sibling.textContent.trim();
                break;
              }
              if (sibling.textContent.trim()) {
                inputLabel = sibling.textContent.trim();
                break;
              }
              sibling = sibling.previousElementSibling;
            }
            
            // Check parent's previous sibling
            if (!inputLabel && input.parentElement) {
              sibling = input.parentElement.previousElementSibling;
              while (sibling && !inputLabel) {
                if (sibling.tagName === 'LABEL') {
                  inputLabel = sibling.textContent.trim();
                  break;
                }
                if (sibling.textContent.trim()) {
                  inputLabel = sibling.textContent.trim();
                  break;
                }
                sibling = sibling.previousElementSibling;
              }
            }
          }
          
          // Method 4: Check for placeholder or aria-label
          if (!inputLabel) {
            inputLabel = input.placeholder || input.getAttribute('aria-label') || '';
          }
          
          // Determine input type
          let inputType = input.type || 'text';
          if (input.tagName === 'TEXTAREA') {
            inputType = 'textarea';
          } else if (input.tagName === 'SELECT') {
            inputType = 'select';
          }
          
          // Check if input is hidden
          const isHidden = input.type === 'hidden' || 
                          input.style.display === 'none' || 
                          input.style.visibility === 'hidden' ||
                          input.hasAttribute('hidden') ||
                          window.getComputedStyle(input).display === 'none' ||
                          window.getComputedStyle(input).visibility === 'hidden';
          
          // Get options for select elements
          let options = null;
          if (input.tagName === 'SELECT') {
            options = Array.from(input.options).map(option => ({
              value: option.value,
              text: option.textContent.trim()
            }));
          }
          
          return {
            inputType: inputType,
            inputLabel: inputLabel,
            id: input.id || null,
            hidden: isHidden,
            options: options
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

  async fillInputsWithDummyData() {
    try {
      console.log('Filling inputs with dummy data...');
      
      await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('form input, form textarea, form select'));
        
        inputs.forEach(input => {
          // Skip hidden inputs
          if (input.type === 'hidden' || 
              input.style.display === 'none' || 
              input.style.visibility === 'hidden' ||
              input.hasAttribute('hidden') ||
              window.getComputedStyle(input).display === 'none' ||
              window.getComputedStyle(input).visibility === 'hidden') {
            return;
          }
          
          // Fill based on input type
          switch (input.type) {
            case 'text':
            case 'email':
              input.value = 'test@example.com';
              break;
            case 'tel':
              input.value = '+1234567890';
              break;
            case 'number':
              input.value = '42';
              break;
            case 'date':
              input.value = '2024-01-01';
              break;
            case 'url':
              input.value = 'https://example.com';
              break;
            case 'password':
              input.value = 'testpassword123';
              break;
            case 'checkbox':
              input.checked = true;
              break;
            case 'radio':
              if (input.name) {
                // Check the first radio button in each group
                const radios = document.querySelectorAll(`input[name="${input.name}"]`);
                if (radios[0] === input) {
                  input.checked = true;
                }
              }
              break;
            default:
              input.value = 'test';
          }
          
          // Trigger events to simulate user interaction
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('blur', { bubbles: true }));
        });
        
        // Handle textareas
        const textareas = Array.from(document.querySelectorAll('form textarea'));
        textareas.forEach(textarea => {
          textarea.value = 'This is a test textarea content for form validation.';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          textarea.dispatchEvent(new Event('blur', { bubbles: true }));
        });
        
        // Handle select elements
        const selects = Array.from(document.querySelectorAll('form select'));
        selects.forEach(select => {
          if (select.options.length > 0) {
            select.selectedIndex = 1; // Select second option (skip first if it's "Please select")
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      });
      
      console.log('Inputs filled with dummy data');
      
      // Wait a bit for any dynamic content to load
      await this.page.waitForTimeout(2000);
      
    } catch (error) {
      console.error('Failed to fill inputs with dummy data:', error);
    }
  }

  async extractFormInputsWithConditional() {
    try {
      console.log('Extracting form inputs with iterative conditional detection...');
      
      // First pass: Extract initial inputs
      console.log('First pass: Extracting initial inputs...');
      const initialInputs = await this.extractFormInputs();
      let allInputs = [...initialInputs];
      let iteration = 1;
      let newInputsFound = true;
      
      while (newInputsFound) {
        console.log(`\nIteration ${iteration}: Filling inputs and detecting new ones...`);
        
        // Fill all current inputs with dummy data
        await this.fillInputsWithDummyData();
        
        // Extract inputs after filling
        const currentInputs = await this.extractFormInputs();
        
        // Find new inputs that weren't in our collection
        const newInputs = this.findNewInputs(allInputs, currentInputs);
        
        if (newInputs.length > 0) {
          console.log(`Found ${newInputs.length} new conditional inputs in iteration ${iteration}`);
          
          // Mark new inputs as conditional
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
      
      // Now handle multiple choice inputs with 4 or fewer options
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

  async tryAllMultipleChoiceOptions(input, allInputs) {
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

  async tryAllRadioOptions(input, allInputs) {
    try {
      const radioOptions = await this.page.evaluate((inputId) => {
        const radios = Array.from(document.querySelectorAll(`input[name="${inputId}"]`));
        return radios.map((radio, index) => ({
          index,
          value: radio.value,
          text: radio.nextElementSibling?.textContent?.trim() || radio.value
        }));
      }, input.id);
      
      if (radioOptions.length <= 4) {
        console.log(`  Radio group has ${radioOptions.length} options, trying each...`);
        
        for (let i = 0; i < radioOptions.length; i++) {
          console.log(`    Trying option ${i + 1}: ${radioOptions[i].text}`);
          
          // Select this radio option
          await this.page.evaluate((inputId, optionIndex) => {
            const radios = Array.from(document.querySelectorAll(`input[name="${inputId}"]`));
            if (radios[optionIndex]) {
              radios[optionIndex].checked = true;
              radios[optionIndex].dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, input.id, i);
          
          // Wait for any dynamic content
          await this.page.waitForTimeout(1000);
          
          // Check for new inputs
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

  async tryAllSelectOptions(input, allInputs) {
    try {
      const selectOptions = await this.page.evaluate((inputId) => {
        const select = document.getElementById(inputId);
        if (!select) return [];
        
        return Array.from(select.options).map((option, index) => ({
          index,
          value: option.value,
          text: option.textContent.trim()
        }));
      }, input.id);
      
      if (selectOptions.length <= 4) {
        console.log(`  Select has ${selectOptions.length} options, trying each...`);
        
        for (let i = 0; i < selectOptions.length; i++) {
          console.log(`    Trying option ${i + 1}: ${selectOptions[i].text}`);
          
          // Select this option
          await this.page.evaluate((inputId, optionIndex) => {
            const select = document.getElementById(inputId);
            if (select && select.options[optionIndex]) {
              select.selectedIndex = optionIndex;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, input.id, i);
          
          // Wait for any dynamic content
          await this.page.waitForTimeout(1000);
          
          // Check for new inputs
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

  findNewInputs(existingInputs, currentInputs) {
    const existingKeys = new Set(existingInputs.map(input => this.createInputKey(input)));
    
    return currentInputs.filter(input => {
      const key = this.createInputKey(input);
      return !existingKeys.has(key);
    });
  }

  createInputKey(input) {
    // Create a unique key for an input based on its properties
    return `${input.id || 'no-id'}_${input.inputType}_${input.inputLabel}`;
  }

  async scrapeJobPage(url, options = {}) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const defaultOptions = {
      waitTime: 3000,
      waitForSelector: null,
      scrollToBottom: false,
      takeScreenshot: false,
      screenshotName: null,
      extractForms: false,
      extractLinks: false,
      clickApplyButton: false,
      sendFormHTMLOnly: true,
      extractFormInputs: true,
      detectConditionalInputs: true, // New option to detect conditional inputs
      ...options
    };

    try {
      console.log(`Navigating to: ${url}`);
      
      // Navigate to the page
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Handle cookie popup
      await this.handleCookiePopup();

      // Click Apply button if requested
      if (defaultOptions.clickApplyButton) {
        await this.clickApplyButton();
      }

      // Wait for additional time if specified
      if (defaultOptions.waitTime) {
        console.log(`Waiting for ${defaultOptions.waitTime}ms...`);
        await this.page.waitForTimeout(defaultOptions.waitTime);
      }

      // Wait for specific selector if provided
      if (defaultOptions.waitForSelector) {
        console.log(`Waiting for selector: ${defaultOptions.waitForSelector}`);
        try {
          await this.page.waitForSelector(defaultOptions.waitForSelector, { timeout: 10000 });
        } catch (error) {
          console.log(`Selector ${defaultOptions.waitForSelector} not found, continuing...`);
        }
      }

      // Scroll to load dynamic content if needed
      if (defaultOptions.scrollToBottom) {
        console.log('Scrolling to bottom to load dynamic content...');
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.page.waitForTimeout(2000);
      }

      // Get the appropriate data based on options
      let html = null;
      let formInputs = null;
      
      if (defaultOptions.extractFormInputs) {
        if (defaultOptions.detectConditionalInputs) {
          formInputs = await this.extractFormInputsWithConditional();
        } else {
          formInputs = await this.extractFormInputs();
        }
        console.log('Form inputs extracted successfully');
      } else if (defaultOptions.sendFormHTMLOnly) {
        html = await this.extractFormHTML();
        if (!html) {
          html = await this.page.content();
          console.log('No forms found, using full page HTML');
        }
      } else {
        html = await this.page.content();
      }
      
      console.log('Data harvested successfully');

      // Extract additional data if requested
      let extractedData = {};
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
        isFormHTML: defaultOptions.sendFormHTMLOnly && html !== null,
        isFormInputs: defaultOptions.extractFormInputs && formInputs !== null
      };

    } catch (error) {
      console.error(`Failed to scrape page ${url}:`, error);
      throw error;
    }
  }

  async extractForms() {
    try {
      return await this.page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form'));
        return forms.map((form, index) => ({
          id: form.id || `form-${index}`,
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            required: input.required,
            // Don't include the actual value to keep data clean
            hasValue: input.value && input.value.trim() !== '',
            valueLength: input.value ? input.value.length : 0
          }))
        }));
      });
    } catch (error) {
      console.error('Failed to extract forms:', error);
      return [];
    }
  }

  async extractLinks() {
    try {
      return await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        return links.map(link => ({
          text: link.textContent.trim(),
          href: link.href,
          title: link.title
        }));
      });
    } catch (error) {
      console.error('Failed to extract links:', error);
      return [];
    }
  }

  async processJobApplication(url, options = {}) {
    try {
      // Scrape the page
      const scrapedData = await this.scrapeJobPage(url, options);
      
      // Save API response to JSON file
      await this.saveResponseToFile(url, scrapedData, options);
      
      return {
        success: true,
        scrapedData,
      };
    } catch (error) {
      console.error('Failed to process job application:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async saveResponseToFile(url, scrapedData, options = {}) {
    try {
      // Create output directory if it doesn't exist
      const outputDir = options.outputDir || './output';
      await fs.mkdir(outputDir, { recursive: true });
      
      // Generate filename with timestamp and sanitized URL
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const urlSlug = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `response_${urlSlug}_${timestamp}.json`;
      const filepath = path.join(outputDir, filename);
      
      // Prepare the data to save
      const outputData = {
        pageTitle: scrapedData.pageTitle,
        timestamp: scrapedData.timestamp,
        inputs: scrapedData.formInputs,
      };
      
      // Write to file
      await fs.writeFile(filepath, JSON.stringify(outputData, null, 2));
      console.log(`API response saved to: ${filepath}`);
      
      return filepath;
    } catch (error) {
      console.error('Failed to save response to file:', error);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      console.log('Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

module.exports = JobApplicationScraper; 
