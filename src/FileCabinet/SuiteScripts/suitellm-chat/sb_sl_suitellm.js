/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope Public
 *
 * @author Budy Sutjijati
 * @see https://www.linkedin.com/in/budysutjijati/
 *
 * sb_sl_suitellm.js
 *
 * ██████╗ ██╗   ██╗██████╗ ██╗   ██╗
 * ██╔══██╗██║   ██║██╔══██╗╚██╗ ██╔╝
 * ██████╔╝██║   ██║██║  ██║ ╚████╔╝
 * ██╔══██╗██║   ██║██║  ██║  ╚██╔╝
 * ██████╔╝╚██████╔╝██████╔╝   ██║
 * ╚═════╝  ╚═════╝ ╚═════╝    ╚═╝
 * ███████╗██╗   ██╗████████╗  ██╗██╗     ██╗ █████╗ ████████╗██╗
 * ██╔════╝██║   ██║╚══██╔══╝  ██║██║     ██║██╔══██╗╚══██╔══╝██║
 * ███████╗██║   ██║   ██║     ██║██║     ██║███████║   ██║   ██║
 * ╚════██║██║   ██║   ██║██   ██║██║██   ██║██╔══██║   ██║   ██║
 * ███████║╚██████╔╝   ██║╚█████╔╝██║╚█████╔╝██║  ██║   ██║   ██║
 * ╚══════╝ ╚═════╝    ╚═╝ ╚════╝ ╚═╝ ╚════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝
 *
 */

define(['N/ui/serverWidget', 'N/llm', 'N/query'], (serverWidget, llm, query) => {

    /**
     * Retrieve File URL using SuiteQL
     * @returns {string|null} File URL
     */
    function getReactAppUrl() {
        try {
            const sql = `
                SELECT URL 
                FROM File 
                WHERE name = 'suitellm-react-app.js'
            `;

            const resultSet = query.runSuiteQL({ query: sql });
            const results = resultSet.asMappedResults();

            if (results.length > 0 && results[0].url) {
                return results[0].url;
            }

            throw new Error(`File "suitellm-react-app.js" not found.`);
        } catch (error) {
            log.error('SuiteQL File Retrieval Error', error.message);
            return null;
        }
    }

    /**
     * Main Suitelet Request Handler
     */
    function onRequest(context) {
        if (context.request.method === 'GET') {
            const form = serverWidget.createForm({
                title: 'SuiteLLM Chat'
            });

            const htmlField = form.addField({
                id: 'custpage_react_ui',
                type: serverWidget.FieldType.INLINEHTML,
                label: 'SuiteLLM Chat'
            });

            // Retrieve React App URL dynamically
            const reactAppUrl = getReactAppUrl();

            if (!reactAppUrl) {
                htmlField.defaultValue = `<div style="color:red; text-align:center;">Error: File 'suitellm-react-app.js' not found in File Cabinet.</div>`;
                context.response.writePage(form);
                return;
            }

            // Inline React App Integration
            htmlField.defaultValue = `
                <div id="root"></div>    

                <!-- React App Module Script -->
                <script type="module">
                    import('${reactAppUrl}')
                        .then(() => {
                            console.log('React App loaded successfully.');
                        })
                        .catch((error) => {
                            console.error('Failed to load React App:', error);
                        });
                </script>
            `;

            context.response.writePage(form);
        }
        else if (context.request.method === 'POST') {
            try {
                const body = JSON.parse(context.request.body);

                if (body.action === 'get_llm_response') {
                    if (!body.prompt || typeof body.prompt !== 'string') {
                        throw new Error('Missing or invalid "prompt" in the request body.');
                    }

                    const chatHistory = body.chatHistory.map((msg) => ({
                        role: msg.role === 'user' ? llm.ChatRole.USER : llm.ChatRole.CHATBOT,
                        text: msg.text
                    }));

                    const response = llm.generateText({
                        prompt: body.prompt,
                        chatHistory: chatHistory
                    });

                    const remainingUsage = llm.getRemainingFreeUsage();

                    context.response.setHeader({
                        name: 'Content-Type',
                        value: 'application/json'
                    });

                    context.response.write(JSON.stringify({
                        text: response.text,
                        remainingUsage: remainingUsage
                    }));
                } else {
                    throw new Error('Invalid action in the request body.');
                }
            } catch (error) {
                log.error('LLM API Error', error.message);
                context.response.setHeader({
                    name: 'Content-Type',
                    value: 'application/json'
                });
                context.response.write(JSON.stringify({ error: error.message }));
            }
        }
    }

    return { onRequest };
});