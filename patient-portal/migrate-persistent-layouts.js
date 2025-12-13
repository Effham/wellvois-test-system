#!/usr/bin/env node

/**
 * Automated Migration Script for Persistent Layouts
 * 
 * This script automatically converts pages from the old pattern (wrapping content in AppLayout)
 * to the new pattern (using withAppLayout helper for persistent layouts).
 * 
 * Usage: node migrate-persistent-layouts.js
 */

const fs = require('fs');
const path = require('path');

// Pages to skip (already migrated or special cases)
const SKIP_FILES = [
    'dashboard.tsx', // Already migrated
    'PractitionerDashboard/Index.tsx', // Uses .layout property directly
    'PatientDashboard/Index.tsx', // Uses .layout property directly
    'auth/', // Auth pages use different layout
    'PublicPortal/', // Public pages
    'Legal/', // Legal pages
    'Documents/', // Document pages
    'welcome.tsx', // Welcome page
    'TenantSelection.tsx', // Special page
    'RegisterPublic.tsx', // Public registration
];

function shouldSkipFile(filePath) {
    return SKIP_FILES.some(skip => filePath.includes(skip));
}

function extractBreadcrumbs(content) {
    // Try to find breadcrumbs definition
    const breadcrumbsMatch = content.match(/const breadcrumbs:\s*BreadcrumbItem\[\]\s*=\s*(\[[\s\S]*?\]);/);
    if (breadcrumbsMatch) {
        return breadcrumbsMatch[1];
    }
    
    // Try to find inline breadcrumbs in AppLayout
    const inlineMatch = content.match(/<AppLayout\s+breadcrumbs=\{(\[[\s\S]*?\])\}/);
    if (inlineMatch) {
        return inlineMatch[1];
    }
    
    return null;
}

function migratePage(filePath) {
    console.log(`\nProcessing: ${filePath}`);
    
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Check if already migrated
    if (content.includes('withAppLayout') || content.includes('.layout =')) {
        console.log('  ✓ Already migrated, skipping');
        return false;
    }
    
    // Check if uses AppLayout
    if (!content.includes('import AppLayout') && !content.includes('import.*AppLayout')) {
        console.log('  ✗ Does not use AppLayout, skipping');
        return false;
    }
    
    // Extract breadcrumbs
    const breadcrumbs = extractBreadcrumbs(content);
    
    // Step 1: Change import
    content = content.replace(
        /import AppLayout from ['"]@\/layouts\/app-layout['"]/,
        "import { withAppLayout } from '@/utils/layout'"
    );
    
    // Step 2: Change export default function to just function
    content = content.replace(
        /export default function\s+(\w+)/,
        'function $1'
    );
    
    // Step 3: Remove breadcrumbs const if exists (we'll move it to withAppLayout)
    if (breadcrumbs) {
        content = content.replace(
            /const breadcrumbs:\s*BreadcrumbItem\[\]\s*=\s*\[[\s\S]*?\];/,
            ''
        );
    }
    
    // Step 4: Remove AppLayout wrapper (complex regex to handle nested JSX)
    // Find the return statement with AppLayout
    const returnMatch = content.match(/return\s*\(\s*<AppLayout[\s\S]*?breadcrumbs=\{[\s\S]*?\}[\s\S]*?>/);
    if (returnMatch) {
        // Replace <AppLayout breadcrumbs={...}> with <>
        content = content.replace(
            /<AppLayout\s+breadcrumbs=\{[^\}]*\}>/,
            '<>'
        );
        
        // Find and replace closing </AppLayout>
        // We need to find the matching closing tag (last occurrence usually)
        const lastAppLayoutClose = content.lastIndexOf('</AppLayout>');
        if (lastAppLayoutClose !== -1) {
            content = content.substring(0, lastAppLayoutClose) + '</>' + content.substring(lastAppLayoutClose + 12);
        }
    }
    
    // Step 5: Get component name
    const componentNameMatch = content.match(/function\s+(\w+)/);
    if (!componentNameMatch) {
        console.log('  ✗ Could not find component name, skipping');
        return false;
    }
    const componentName = componentNameMatch[1];
    
    // Step 6: Add export with withAppLayout at the end
    let exportStatement = `\nexport default withAppLayout(${componentName}`;
    
    if (breadcrumbs) {
        exportStatement += `, {\n    breadcrumbs: ${breadcrumbs}\n}`;
    }
    
    exportStatement += ');\n';
    
    // Append export at the end (before last closing brace)
    content = content.trimEnd();
    if (!content.endsWith('}')) {
        content += '\n}';
    }
    content += exportStatement;
    
    // Only write if content actually changed
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log('  ✓ Migrated successfully');
        return true;
    } else {
        console.log('  ✗ No changes made');
        return false;
    }
}

function getAllTsxFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllTsxFiles(filePath, fileList);
        } else if (file.endsWith('.tsx') && !file.endsWith('.backup')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

function main() {
    console.log('==============================================');
    console.log('Persistent Layouts Migration Script');
    console.log('==============================================\n');
    
    const pagesDir = path.join(process.cwd(), 'resources/js/pages');
    
    if (!fs.existsSync(pagesDir)) {
        console.error('Error: resources/js/pages directory not found');
        process.exit(1);
    }
    
    const allFiles = getAllTsxFiles(pagesDir);
    const filesToMigrate = allFiles.filter(f => !shouldSkipFile(f));
    
    console.log(`Found ${allFiles.length} total .tsx files`);
    console.log(`Skipping ${allFiles.length - filesToMigrate.length} files (already migrated or special cases)`);
    console.log(`Attempting to migrate ${filesToMigrate.length} files\n`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    filesToMigrate.forEach(file => {
        try {
            const result = migratePage(file);
            if (result) {
                migrated++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error(`  ✗ Error: ${error.message}`);
            errors++;
        }
    });
    
    console.log('\n==============================================');
    console.log('Migration Summary');
    console.log('==============================================');
    console.log(`✓ Successfully migrated: ${migrated}`);
    console.log(`○ Skipped (already done or N/A): ${skipped}`);
    console.log(`✗ Errors: ${errors}`);
    console.log('==============================================\n');
    
    if (migrated > 0) {
        console.log('Next steps:');
        console.log('1. Run: npm run build');
        console.log('2. Test navigation in your app');
        console.log('3. Verify no console errors');
        console.log('4. Enjoy faster page transitions! 🚀\n');
    }
}

main();

