const fs = require('fs');

function update(htmlFile, jsFile) {
    const html = fs.readFileSync(htmlFile, 'utf8');
    // Escape backticks and dollar signs for template literal
    const jsContent = 'export const htmlString = `' + html.replace(/`/g, '\\`').replace(/\$/g, '\\$') + '`;\n';
    fs.writeFileSync(jsFile, jsContent, 'utf8');
    console.log('Updated ' + jsFile);
}

update('preview-rescuer.html', 'rescuer-app/htmlStr.js');
update('preview-mobile-app.html', 'public-sos-app/htmlStr.js');
