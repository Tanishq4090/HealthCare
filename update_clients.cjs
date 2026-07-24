const fs = require('fs');
const path = './src/admin/Clients.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!content.includes('ClientDetailsModal')) {
    content = content.replace(
        `import { supabase } from '../lib/supabase';`,
        `import { supabase } from '../lib/supabase';\nimport ClientDetailsModal from './components/ClientDetailsModal';`
    );
}

// 2. Add inspectingClient state
if (!content.includes('inspectingClient')) {
    content = content.replace(
        `    const [isSubmitting, setIsSubmitting] = useState(false);`,
        `    const [isSubmitting, setIsSubmitting] = useState(false);\n\n    const [inspectingClient, setInspectingClient] = useState<any>(null);`
    );
}

// 3. Update the onClick
content = content.replace(
    `onClick={() => navigate('/admin/crm', { state: { openLeadId: client.id } })}`,
    `onClick={() => setInspectingClient(client)}`
);

// 4. Render modal at the end
if (!content.includes('<ClientDetailsModal')) {
    content = content.replace(
        `        </div>\n    );\n}\n`,
        `            {inspectingClient && (\n                <ClientDetailsModal \n                    clientId={inspectingClient.id} \n                    onClose={() => setInspectingClient(null)} \n                />\n            )}\n        </div>\n    );\n}\n`
    );
}

fs.writeFileSync(path, content, 'utf8');
console.log("Updated Clients.tsx");
