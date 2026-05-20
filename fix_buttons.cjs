const fs = require('fs');
const file = '/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/HR.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetBtn1 = `                                        <Send className="w-4 h-4" />
                                        Generate & Dispatch All
                                    </>
                                )}
                            </button>`;

const replacementBtn1 = `                                        <RefreshCw className="w-4 h-4" />
                                        Run Monthly Payroll
                                    </>
                                )}
                            </button>`;

if (content.includes(targetBtn1)) {
    content = content.replace(targetBtn1, replacementBtn1);
    console.log("Replaced btn1");
}

fs.writeFileSync(file, content);
