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
 *
 * 888888b.                 888                .d8888b.           888     d8b d8b  d8b          888    d8b
 * 888  "88b                888               d88P  Y88b          888     Y8P Y8P  Y8P          888    Y8P
 * 888  .88P                888               Y88b.               888                           888
 * 8888888K.  888  888  .d88888 888  888       "Y888b.   888  888 888888 8888 888 8888  8888b.  888888 888
 * 888  "Y88b 888  888 d88" 888 888  888          "Y88b. 888  888 888    "888 888 "888     "88b 888    888
 * 888    888 888  888 888  888 888  888            "888 888  888 888     888 888  888 .d888888 888    888
 * 888   d88P Y88b 888 Y88b 888 Y88b 888      Y88b  d88P Y88b 888 Y88b.   888 888  888 888  888 Y88b.  888
 * 8888888P"   "Y88888  "Y88888  "Y88888       "Y8888P"   "Y88888  "Y888  888 888  888 "Y888888  "Y888 888
 *                                   888                                  888      888
 *                              Y8b d88P                                 d88P     d88P
 *                               "Y88P"                                888P"    888P"
 */

define(['N/ui/serverWidget', 'N/llm', 'N/query'], (serverWidget, llm, query) => {

    /**
     * Retrieve File URL using SuiteQL
     * @returns {string|null} File URL
     */
    function getReactAppUrl() {
        try {

            // Instead of hard coding the file id from the React file we simply perform a search
            // and construct the URL path to the Filecabinet dynamically. This way, after deployment, you don't need
            // to change the file id in this Suitelet.
            const sql = `
                SELECT URL 
                FROM File 
                WHERE name = 'suitellm-react-app.js'
            `;

            const resultSet = query.runSuiteQL({ query: sql });
            const results = resultSet.asMappedResults();

            if (results.length > 0 && results[0].url) {
                return results[0].url; // The actual ID from the react app that resides in the file cabinet
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