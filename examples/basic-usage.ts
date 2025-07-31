import JobApplicationScraper from '../src/scraper-service.js';

// Advanced usage example with all features
async function advancedExample(): Promise<void> {
  const scraper = new JobApplicationScraper({
    screenshotDir: './screenshots',
    headless: false
  });
  
  try {
    await scraper.initialize();
    
    const result = await scraper.processJobApplication('https://barhale.kallidusrecruit.com/VacancyInformation.aspx?VId=1213', {
      waitTime: 5000,
      scrollToBottom: true,
      takeScreenshot: true,
      screenshotName: 'barhale-job-application.png',
      extractForms: true,
      extractLinks: true,
      outputDir: './output/advanced',
      includeFullHtml: false,
      clickApplyButton: true,
      extractFormInputs: true,
      detectConditionalInputs: true
    });
    
    // Log the structured form inputs
    if (result.success && result.scrapedData?.formInputs) {
      const totalInputs = result.scrapedData.formInputs.length;
      const conditionalInputs = result.scrapedData.formInputs.filter(i => i.conditional).length;
      const hiddenInputs = result.scrapedData.formInputs.filter(i => i.hidden).length;
      const triggeredInputs = result.scrapedData.formInputs.filter(i => i.triggeredBy).length;
      
      console.log(`\n📊 Summary:`);
      console.log(`  Total inputs: ${totalInputs}`);
      console.log(`  Conditional inputs: ${conditionalInputs}`);
      console.log(`  Hidden inputs: ${hiddenInputs}`);
      console.log(`  Visible inputs: ${totalInputs - hiddenInputs}`);
      console.log(`  Triggered by multiple choice: ${triggeredInputs}`);
      
      // Group by iteration
      const inputsByIteration: { [key: number]: any[] } = {};
      result.scrapedData.formInputs.forEach(input => {
        const iteration = input.iteration || 0;
        if (!inputsByIteration[iteration]) {
          inputsByIteration[iteration] = [];
        }
        inputsByIteration[iteration].push(input);
      });
      
      console.log(`\n🔄 Inputs by iteration:`);
      Object.keys(inputsByIteration).sort((a, b) => parseInt(a) - parseInt(b)).forEach(iteration => {
        console.log(`  Iteration ${iteration}: ${inputsByIteration[parseInt(iteration)].length} inputs`);
      });
    }
    
  } catch (error) {
    console.error('Advanced example error:', error);
  } finally {
    await scraper.close();
  }
}

// Run the advanced example
async function runExample(): Promise<void> {
  console.log('=== Running Advanced Example ===');
  await advancedExample();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runExample();
}

export { advancedExample }; 
