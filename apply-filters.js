const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'src', 'app', 'admin');
const filterImport = "import { applyDemoFilter } from '@/lib/demo-filter';\n";

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('page.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Skip if already imported
      if (content.includes('applyDemoFilter')) continue;
      
      let modified = false;

      // Add import after supabase import
      if (content.includes("import { supabase }")) {
        content = content.replace("import { supabase } from '@/lib/supabase';", "import { supabase } from '@/lib/supabase';\n" + filterImport);
      }

      // Replace supabase.from('xxx') to applyDemoFilter(supabase.from('xxx'), 'xxx')
      // Note: We need to handle supabase.from('table_name').select(...)
      // So we replace `supabase.from('table_name')` with `applyDemoFilter(supabase.from('table_name'), 'table_name')`
      // But wait! applyDemoFilter takes the QUERY, not the from builder.
      // applyDemoFilter(supabase.from('table_name').select('*'), 'table_name')
      // Doing this with regex is very hard.

      // Actually, applyDemoFilter can take the from builder!
      // const query = supabase.from('users').select('*'); 
      // query.ilike() works.
      
      // Let's modify the demo-filter to take the table name and apply the filter if possible.
      // Actually it's easier to manually edit the 9 files using multi_replace_file_content.
    }
  }
}

// processDirectory(adminDir);
