(function () {
    'use strict';

    // Supported language configuration
    const SUPPORTED_LANGUAGES = {
        'php': {
            name: 'PHP',
            builder: buildPhp
        },
        'js': {
            name: 'JavaScript (Axios)',
            builder: buildJs
        },
        'fetch': {
            name: 'JavaScript (Fetch API)',
            builder: buildFetch
        }
    };

    // Message constants
    const MESSAGES = {
        emptyInput: "Empty curl command cannot be processed.",
        invalidCurl: "Invalid cURL command.",
        unsupportedLanguage: "Unsupported language: ",
        jsonParseError: "Error parsing JSON data."
    };

    /**
     * Convert a curl command to code in the specified language
     * @param {string} lang - Target language (php, js, fetch)
     * @param {string} curlInput - The curl command to convert
     * @returns {string} Generated code
     * @throws {Error} If the input is invalid or language is not supported
     */
    function curlToCode(lang, curlInput) {
        // Validate input
        if (!curlInput || !curlInput.trim()) {
            return "";
        }

        try {
            // Parse the command
            const cmd = parseCommand(curlInput, { boolFlags: boolOptions });

            // Validate that it's a curl command
            if (!cmd._ || !cmd._[0] || cmd._[0] !== "curl") {
                throw new Error(MESSAGES.invalidCurl);
            }

            // Extract relevant pieces from the command
            const req = extractRelevantPieces(cmd);

            // Default to GET if no method specified
            if (!req.method) req.method = "GET";

            // Get the language key and convert to lowercase
            const langKey = (lang || '').toLowerCase();

            // Check if the language is supported
            if (SUPPORTED_LANGUAGES[langKey]) {
                return SUPPORTED_LANGUAGES[langKey].builder(req);
            } else {
                throw new Error(MESSAGES.unsupportedLanguage + lang);
            }
        } catch (error) {
            // Re-throw if it's our known error, otherwise wrap it
            if (error.message &&
                (error.message.includes(MESSAGES.invalidCurl) ||
                    error.message.includes(MESSAGES.unsupportedLanguage))) {
                throw error;
            }
            throw new Error(`Error processing curl command: ${error.message}`);
        }
    }

    var boolOptions = [
        "#", "progress-bar", "-", "next", "0", "http1.0", "http1.1", "http2",
        "no-npn", "no-alpn", "1", "tlsv1", "2", "sslv2", "3", "sslv3", "4", "ipv4", "6",
        "ipv6", "a", "append", "anyauth", "B", "use-ascii", "basic", "compressed",
        "create-dirs", "crlf", "digest", "disable-eprt", "disable-epsv", "environment",
        "cert-status", "false-start", "f", "fail", "ftp-create-dirs", "ftp-pasv",
        "ftp-skip-pasv-ip", "ftp-pret", "ftp-ssl-ccc", "ftp-ssl-control", "g", "globoff",
        "G", "get", "ignore-content-length", "i", "include", "I", "head", "j",
        "junk-session-cookies", "J", "remote-header-name", "k", "insecure", "l", "list-only",
        "L", "location", "location-trusted", "metalink", "n", "netrc", "N", "no-buffer",
        "netrc-file", "netrc-optional", "negotiate", "no-keepalive", "no-sessionid",
        "ntlm", "O", "remote-name", "oauth2-bearer", "p", "proxy-tunnel", "path-as-is",
        "post301", "post302", "post303", "proxy-anyauth", "proxy-basic", "proxy-digest",
        "proxy-negotiate", "proxy-ntlm", "q", "raw", "remote-name-all", "s", "silent",
        "sasl-ir", "S", "show-error", "ssl", "ssl-reqd", "ssl-allow-beast", "ssl-no-revoke",
        "socks5-gssapi-nec", "tcp-nodelay", "tlsv1.0", "tlsv1.1", "tlsv1.2", "tr-encoding",
        "trace-time", "v", "verbose", "xattr", "h", "help", "M", "manual", "V", "version"
    ];

    function parseCommand(input, options) {
        if (typeof options === "undefined") {
            options = {};
        }
        var result = { _: [] };
        var cursor = 0;
        input = input.trim();
        if (input.length > 2 && (input[0] === "$" || input[0] === "#") && whitespace(input[1])) {
            input = input.substr(1).trim();
        }
        while (cursor < input.length) {
            skipWhitespace();
            if (cursor < input.length && input[cursor] === "-") {
                flagSet();
            } else {
                unflagged();
            }
        }
        return result;

        function flagSet() {
            if (cursor < input.length - 1 && input[cursor + 1] === "-") {
                longFlag();
            } else {
                shortFlag();
            }
        }

        function shortFlag() {
            cursor++;
            while (cursor < input.length && !whitespace(input[cursor])) {
                let flagName = input[cursor];
                if (typeof result[flagName] === "undefined") {
                    result[flagName] = [];
                }
                cursor++;
                if (boolFlag(flagName)) {
                    result[flagName] = true;
                } else if (Array.isArray(result[flagName])) {
                    result[flagName].push(nextString());
                }
            }
        }

        function longFlag() {
            cursor += 2;
            let flagName = nextString("=");
            if (boolFlag(flagName)) {
                result[flagName] = true;
            } else {
                if (typeof result[flagName] === "undefined") {
                    result[flagName] = [];
                }
                if (Array.isArray(result[flagName])) {
                    result[flagName].push(nextString());
                }
            }
        }

        function unflagged() {
            result._.push(nextString());
        }

        function boolFlag(flag) {
            if (Array.isArray(options.boolFlags)) {
                return options.boolFlags.indexOf(flag) !== -1;
            }
            return false;
        }

        function nextString(endChar) {
            skipWhitespace();
            let str = "";
            let quoted = false;
            let quoteCh = "";
            let escaped = false;
            if (cursor < input.length && (input[cursor] === '"' || input[cursor] === "'")) {
                quoted = true;
                quoteCh = input[cursor];
                cursor++;
            }
            for (; cursor < input.length; cursor++) {
                if (quoted) {
                    if (input[cursor] === quoteCh && !escaped) {
                        quoted = false;
                        continue;
                    }
                }
                if (!quoted && !escaped) {
                    if (whitespace(input[cursor])) {
                        return str;
                    }
                    if (endChar && input[cursor] === endChar) {
                        cursor++;
                        return str;
                    }
                }
                if (!escaped && input[cursor] === "\\") {
                    escaped = true;
                    if (!(cursor < input.length - 1 && input[cursor + 1] === "$")) {
                        continue;
                    }
                }
                str += input[cursor];
                escaped = false;
            }
            return str;
        }

        function skipWhitespace() {
            while (cursor < input.length) {
                if (input[cursor] === "\\" && (cursor < input.length - 1 && whitespace(input[cursor + 1]))) {
                    cursor += 2;
                    continue;
                }
                if (!whitespace(input[cursor])) {
                    break;
                }
                cursor++;
            }
        }

        function whitespace(ch) {
            return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
        }
    }

    function extractRelevantPieces(cmd) {
        let relevant = {
            url: "",
            method: "",
            headers: [],
            data: {}
        };
        if (cmd.url && cmd.url.length > 0) {
            relevant.url = cmd.url[0];
        } else if (cmd._.length > 1) {
            relevant.url = cmd._[1];
        }
        if (cmd.H) relevant.headers = relevant.headers.concat(cmd.H);
        if (cmd.header) relevant.headers = relevant.headers.concat(cmd.header);
        if (cmd.I || cmd.head) {
            relevant.method = "HEAD";
        }
        if (cmd.request && cmd.request.length > 0) {
            relevant.method = cmd.request[cmd.request.length - 1].toUpperCase();
        } else if (cmd.X && cmd.X.length > 0) {
            relevant.method = cmd.X[cmd.X.length - 1].toUpperCase();
        }
        let dataAscii = [];
        let dataMultipart = [];
        let dataFiles = [];

        function loadData(dArr, isMultipart) {
            if (!relevant.method) relevant.method = "POST";
            let hasContentType = relevant.headers.some(h => toTitleCase(h).indexOf("Content-Type") === 0);
            if (!hasContentType && !isMultipart) {
                relevant.headers.push("Content-Type: application/x-www-form-urlencoded");
            }
            for (let i = 0; i < dArr.length; i++) {
                let val = dArr[i];
                if (isMultipart) {
                    dataMultipart.push(val);
                } else {
                    if (val.length > 0 && val[0] === "@") {
                        dataFiles.push(val.substr(1));
                    } else {
                        dataAscii.push(val);
                    }
                }
            }
        }

        if (cmd.d) loadData(cmd.d, false);
        if (cmd.data) loadData(cmd.data, false);
        if (cmd["data-raw"]) loadData(cmd["data-raw"], false);
        if (cmd["data-binary"]) loadData(cmd["data-binary"], false);
        if (cmd.F) loadData(cmd.F, true);
        if (cmd.form) loadData(cmd.form, true);
        if (dataAscii.length > 0) {
            relevant.data.ascii = dataAscii.join("&");
        }
        if (dataMultipart.length > 0) {
            relevant.data.multipart = dataMultipart;
        }
        if (dataFiles.length > 0) {
            relevant.data.files = dataFiles;
        }
        if (cmd.compressed) {
            relevant.compressed = true;
        }
        let basicAuthString = "";
        if (cmd.user && cmd.user.length > 0) {
            basicAuthString = cmd.user[cmd.user.length - 1];
        } else if (cmd.u && cmd.u.length > 0) {
            basicAuthString = cmd.u[cmd.u.length - 1];
        }
        let authSplit = basicAuthString.indexOf(":");
        if (authSplit > -1) {
            relevant.basicauth = {
                user: basicAuthString.substr(0, authSplit),
                pass: basicAuthString.substr(authSplit + 1)
            };
        } else if (basicAuthString) {
            relevant.basicauth = {
                user: basicAuthString,
                pass: "<PASSWORD>"
            };
        }
        return relevant;
    }

    /**
     * Build PHP code from the extracted request data
     * @param {Object} req - Request data object
     * @returns {string} Generated PHP code
     */
    function buildPhp(req) {
        const start = "$ch = curl_init();\n\n";
        const resultCall = "$result = curl_exec($ch);\n";
        const errCheck = "if (curl_errno($ch)) {\n  echo 'Error: ' . curl_error($ch);\n}\n";
        const closeCurl = "curl_close($ch);\n";

        let code = start;
        code += `curl_setopt($ch, CURLOPT_URL, ${phpExpandEnv(req.url)});\n`;
        code += "curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n\n";

        // Check if we can use simplified code
        const isSimpleRequest = (
            req.headers.length === 0 &&
            !req.data.ascii &&
            !req.data.files &&
            !req.data.multipart &&
            !req.basicauth &&
            !req.compressed
        );

        if (isSimpleRequest) {
            code += renderSimple(req.method);
        } else {
            code += renderComplex(req);
        }

        return code;

        /**
         * Render simple PHP code for basic requests
         * @param {string} method - HTTP method
         * @returns {string} Simple PHP code
         */
        function renderSimple(method) {
            let php = "";

            if (method === "POST") {
                php += "curl_setopt($ch, CURLOPT_POST, 1);\n";
            } else if (method === "HEAD") {
                php += "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'HEAD');\n";
                php += "curl_setopt($ch, CURLOPT_NOBODY, true);\n";
            } else if (method !== "GET") {
                php += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpExpandEnv(method)});\n`;
            }

            php += "\n" + resultCall + errCheck + closeCurl;
            return php;
        }

        /**
         * Render complex PHP code for requests with headers, data, etc.
         * @param {Object} r - Request data
         * @returns {string} Complex PHP code
         */
        function renderComplex(r) {
            let php = "";

            // Process headers into a map
            const headersMap = processHeaders(r.headers);

            // Handle HTTP method
            if (r.method === "POST") {
                php += "curl_setopt($ch, CURLOPT_POST, 1);\n";
            } else if (r.method === "HEAD") {
                php += "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'HEAD');\n";
                php += "curl_setopt($ch, CURLOPT_NOBODY, true);\n";
            } else if (r.method !== "GET") {
                php += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpExpandEnv(r.method)});\n`;
            }

            // Handle request data
            if (r.data.ascii || r.data.files || r.data.multipart) {
                const postItems = [];

                // Process ASCII data
                if (r.data.ascii) {
                    const isJson = (headersMap["Content-type"] &&
                        headersMap["Content-type"].toLowerCase().indexOf("json") >= 0);

                    if (isJson) {
                        postItems.push(JSON.stringify(r.data.ascii));
                    } else {
                        postItems.push(`'${phpEsc(r.data.ascii)}'`);
                    }
                }

                // Process file uploads
                if (r.data.files && r.data.files.length > 0) {
                    r.data.files.forEach((filePath, idx) => {
                        const fieldName = `file${idx + 1}`;
                        const snippet = `'${fieldName}' => new CURLFile(realpath(${phpExpandEnv(filePath)}))`;
                        postItems.push(snippet);
                    });
                }

                // Process multipart data
                if (r.data.multipart && r.data.multipart.length > 0) {
                    r.data.multipart.forEach(part => {
                        const eqIndex = part.indexOf("=");
                        if (eqIndex > -1) {
                            const argName = part.substr(0, eqIndex).trim();
                            const argValue = part.substr(eqIndex + 1).trim();

                            if (argValue.startsWith("@")) {
                                const filePath = argValue.substr(1);
                                postItems.push(`'${argName}' => new CURLFile(realpath(${phpExpandEnv(filePath)}))`);
                            } else {
                                postItems.push(`'${argName}' => ${phpExpandEnv(argValue)}`);
                            }
                        }
                    });
                }

                // Add postfields to curl
                if (postItems.length === 1 && !r.data.multipart) {
                    php += `curl_setopt($ch, CURLOPT_POSTFIELDS, ${postItems[0]});\n`;
                } else if (postItems.length > 0) {
                    php += "$postData = array(\n  " + postItems.join(",\n  ") + "\n);\n";
                    php += "curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);\n";
                }
            }

            // Handle authentication
            if (r.basicauth) {
                php += `curl_setopt($ch, CURLOPT_USERPWD, ${phpExpandEnv(r.basicauth.user)} . ':' . ${phpExpandEnv(r.basicauth.pass)});\n`;
            }

            // Handle compression
            if (r.compressed) {
                php += "curl_setopt($ch, CURLOPT_ENCODING, 'gzip, deflate');\n";
            }

            // Add headers
            const headerLines = [];
            for (const h in headersMap) {
                headerLines.push(`'${h}: ${headersMap[h]}'`);
            }

            if (headerLines.length > 0) {
                php += "\n$headers = array(\n  " + headerLines.join(",\n  ") + "\n);\n";
                php += "curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);\n";
            }

            php += "\n" + resultCall + errCheck + closeCurl;
            return php;
        }

        /**
         * Process headers into a map of header names to values
         * @param {Array} headers - Array of header strings
         * @returns {Object} Map of header names to values
         */
        function processHeaders(headers) {
            const headersMap = {};

            for (let i = 0; i < headers.length; i++) {
                const splitIndex = headers[i].indexOf(":");
                if (splitIndex === -1) continue;

                const name = headers[i].substr(0, splitIndex).trim();
                const value = headers[i].substr(splitIndex + 1).trim();
                headersMap[toTitleCase(name)] = value;
            }

            return headersMap;
        }
    }

    /**
     * Build JavaScript code using Axios from the extracted request data
     * @param {Object} req - Request data object
     * @returns {string} Generated JavaScript code with Axios
     */
    function buildJs(req) {
        const method = req.method.toLowerCase();
        const lines = [];

        // Add intro comment and required import
        lines.push("// Convert curl command to Javascript using Axios");
        lines.push("const axios = require('axios');");
        lines.push("");

        // Process JSON content if applicable
        const isJsonContent = hasJsonContentType(req.headers);
        processRequestData(req, isJsonContent, lines);

        // Start building Axios configuration
        lines.push("// Axios request configuration");
        lines.push("const config = {");
        lines.push(`  method: '${method}',`);
        lines.push(`  url: '${jsEsc(req.url)}',`);

        // Add headers
        addHeaders(req.headers, lines);

        // Add authentication
        if (req.basicauth) {
            lines.push("  auth: {");
            lines.push(`    username: '${jsEsc(req.basicauth.user)}',`);
            lines.push(`    password: '${jsEsc(req.basicauth.pass)}'`);
            lines.push("  },");
        }

        // Add request data
        if (req.data.ascii || req.data.files || req.data.multipart) {
            if (req.data.ascii) {
                lines.push("  data: data,");
            }

            // Add file upload examples if needed
            addFileUploadComments(req, lines);
        }

        lines.push("};");
        lines.push("");

        // Add the request and response handling
        lines.push("// Send the request using Axios");
        lines.push("axios(config)");
        lines.push("  .then(response => {");
        lines.push("    console.log('Status:', response.status);");
        lines.push("    console.log('Headers:', response.headers);");
        lines.push("    console.log('Data:', response.data);");
        lines.push("    return response.data;");
        lines.push("  })");
        lines.push("  .catch(error => {");
        lines.push("    console.error('Error:', error);");
        lines.push("    throw error;");
        lines.push("  });");

        return lines.join("\n");

        /**
         * Check if headers contain JSON content type
         * @param {Array} headers - List of headers
         * @returns {boolean} True if JSON content type is found
         */
        function hasJsonContentType(headers) {
            return headers.some(h =>
                h.toLowerCase().indexOf('content-type:') !== -1 &&
                h.toLowerCase().indexOf('json') !== -1
            );
        }

        /**
         * Process request data and add variable declarations to lines
         * @param {Object} req - Request object
         * @param {boolean} isJsonContent - Whether content is JSON
         * @param {Array} lines - Array of code lines
         */
        function processRequestData(req, isJsonContent, lines) {
            if (req.data.ascii && isJsonContent) {
                try {
                    // Parse and format JSON data
                    const jsonObj = JSON.parse(req.data.ascii);
                    lines.push("// Request data (JSON)");
                    lines.push(`const data = ${JSON.stringify(jsonObj, null, 2)};`);
                    lines.push("");
                } catch (e) {
                    // Fallback for invalid JSON
                    lines.push("// Request data");
                    lines.push(`const data = "${jsEsc(req.data.ascii)}";`);
                    lines.push("");
                }
            } else if (req.data.ascii) {
                lines.push("// Request data");
                lines.push(`const data = "${jsEsc(req.data.ascii)}";`);
                lines.push("");
            }
        }

        /**
         * Add headers to the config object
         * @param {Array} headers - List of headers
         * @param {Array} lines - Array of code lines
         */
        function addHeaders(headers, lines) {
            if (headers && headers.length > 0) {
                const mappedHeaders = {};
                headers.forEach(h => {
                    const splitIndex = h.indexOf(":");
                    if (splitIndex !== -1) {
                        const name = h.substr(0, splitIndex).trim();
                        const val = h.substr(splitIndex + 1).trim();
                        mappedHeaders[name] = val;
                    }
                });
                const headersSnippet = JSON.stringify(mappedHeaders, null, 2);
                lines.push(`  headers: ${headersSnippet},`);
            }
        }

        /**
         * Add file upload comment examples to config
         * @param {Object} req - Request object
         * @param {Array} lines - Array of code lines
         */
        function addFileUploadComments(req, lines) {
            // File upload description
            if (req.data.files && req.data.files.length > 0) {
                lines.push("  // Note: For file uploads, you should use FormData");
                lines.push("  // Example:");
                lines.push("  // const FormData = require('form-data');");
                lines.push("  // const fs = require('fs');");
                lines.push("  // const formData = new FormData();");

                req.data.files.forEach((filePath, idx) => {
                    lines.push(`  // formData.append('file${idx + 1}', fs.createReadStream('${jsEsc(filePath)}'));`);
                });

                lines.push("  // config.data = formData;");
                lines.push("  // In this example, we add text instead of the actual file");
            }

            // Multipart form
            if (req.data.multipart && req.data.multipart.length > 0) {
                lines.push("  // Multipart/form-data content:");
                lines.push("  // const FormData = require('form-data');");
                lines.push("  // const formData = new FormData();");

                req.data.multipart.forEach(part => {
                    const eqIndex = part.indexOf("=");
                    if (eqIndex > -1) {
                        const argName = part.substr(0, eqIndex).trim();
                        const argValue = part.substr(eqIndex + 1).trim();
                        if (argValue.startsWith("@")) {
                            const filePath = argValue.substr(1);
                            lines.push(`  // formData.append('${argName}', fs.createReadStream('${jsEsc(filePath)}'));`);
                        } else {
                            lines.push(`  // formData.append('${argName}', '${jsEsc(argValue)}');`);
                        }
                    }
                });

                lines.push("  // config.data = formData;");
            }
        }
    }

    /**
     * Build JavaScript code using Fetch API from the extracted request data
     * @param {Object} req - Request data object
     * @returns {string} Generated JavaScript code with Fetch API
     */
    function buildFetch(req) {
        const method = req.method.toLowerCase();
        const lines = [];

        // Add intro comment
        lines.push("// Convert curl command to Javascript using Fetch API");
        lines.push("");

        // Process headers
        processHeaders(req.headers, lines);

        // Add basic auth if needed
        if (req.basicauth) {
            addBasicAuth(req.basicauth, lines);
        }

        // Process request body
        processRequestBody(req, lines);

        // Create fetch options
        lines.push("// Fetch options");
        lines.push("const options = {");
        lines.push(`  method: '${method}',`);
        lines.push("  headers: headers,");

        // Add body based on content type
        addBodyToOptions(req, lines);

        // Add authentication settings
        if (req.basicauth) {
            lines.push("  ,credentials: 'include'");
        }

        lines.push("};");
        lines.push("");

        // Add the fetch call and response handling
        addFetchCall(req.url, lines);

        return lines.join("\n");

        /**
         * Process request headers and add to lines
         * @param {Array} headers - List of headers
         * @param {Array} lines - Array of code lines
         */
        function processHeaders(headers, lines) {
            if (headers && headers.length > 0) {
                const mappedHeaders = {};
                headers.forEach(h => {
                    const splitIndex = h.indexOf(":");
                    if (splitIndex !== -1) {
                        const name = h.substr(0, splitIndex).trim();
                        const val = h.substr(splitIndex + 1).trim();
                        mappedHeaders[name] = val;
                    }
                });
                lines.push(`const headers = ${JSON.stringify(mappedHeaders, null, 2)};`);
                lines.push("");
            } else {
                lines.push("const headers = {};");
                lines.push("");
            }
        }

        /**
         * Add basic auth credentials to headers
         * @param {Object} auth - Basic auth credentials
         * @param {Array} lines - Array of code lines
         */
        function addBasicAuth(auth, lines) {
            lines.push("// Basic Auth credentials");
            lines.push(`const auth = '${jsEsc(auth.user)}:${jsEsc(auth.pass)}';`);
            lines.push("const base64Auth = btoa(auth);");
            lines.push("headers['Authorization'] = 'Basic ' + base64Auth;");
            lines.push("");
        }

        /**
         * Process request body data and add to lines
         * @param {Object} req - Request object
         * @param {Array} lines - Array of code lines
         */
        function processRequestBody(req, lines) {
            const hasBody = req.data.ascii || req.data.files || req.data.multipart;
            const isJsonContentType = req.headers.some(h =>
                h.toLowerCase().indexOf('content-type:') !== -1 &&
                h.toLowerCase().indexOf('json') !== -1
            );
            const isFormContentType = req.headers.some(h =>
                h.toLowerCase().indexOf('content-type:') !== -1 &&
                h.toLowerCase().indexOf('form') !== -1
            );

            if (hasBody) {
                if (req.data.multipart || (req.data.files && req.data.files.length > 0)) {
                    processMultipartFormData(req, lines);
                } else if (req.data.ascii) {
                    if (isJsonContentType) {
                        processJsonData(req.data.ascii, lines);
                    } else if (isFormContentType) {
                        processFormData(req.data.ascii, lines);
                    } else {
                        processPlainData(req.data.ascii, lines);
                    }
                }
            }
        }

        /**
         * Process multipart form data
         * @param {Object} req - Request object
         * @param {Array} lines - Array of code lines
         */
        function processMultipartFormData(req, lines) {
            lines.push("// Create FormData (for multipart/form-data)");
            lines.push("const formData = new FormData();");

            if (req.data.multipart && req.data.multipart.length > 0) {
                req.data.multipart.forEach(part => {
                    const eqIndex = part.indexOf("=");
                    if (eqIndex > -1) {
                        const argName = part.substr(0, eqIndex).trim();
                        const argValue = part.substr(eqIndex + 1).trim();

                        if (argValue.startsWith("@")) {
                            const filePath = argValue.substr(1);
                            addFileFieldToFormData(argName, filePath, lines);
                        } else {
                            lines.push(`formData.append('${argName}', '${jsEsc(argValue)}');`);
                        }
                    }
                });
            }

            if (req.data.files && req.data.files.length > 0) {
                req.data.files.forEach((filePath, idx) => {
                    const fieldName = `file${idx + 1}`;
                    addFileFieldToFormData(fieldName, filePath, lines);
                });
            }

            lines.push("");
        }

        /**
         * Add file field to FormData with appropriate comments
         * @param {string} fieldName - Field name
         * @param {string} filePath - File path
         * @param {Array} lines - Array of code lines
         */
        function addFileFieldToFormData(fieldName, filePath, lines) {
            lines.push("// Note: In browser environment, you need an <input type='file'> element");
            lines.push("// In Node.js environment, use this:");
            lines.push("// const fs = require('fs');");
            lines.push(`// formData.append('${fieldName}', fs.createReadStream('${jsEsc(filePath)}'), '${jsEsc(filePath.split(/[\\\/]/).pop())}');`);
            lines.push("// In browser environment, use this:");
            lines.push("// formData.append('" + fieldName + "', fileInput.files[0]);");
            lines.push("// In this example, we're adding text instead of the actual file:");
            lines.push(`formData.append('${fieldName}', '[FILE CONTENT: ${jsEsc(filePath)}]');`);
        }

        /**
         * Process JSON data
         * @param {string} jsonData - JSON data string
         * @param {Array} lines - Array of code lines
         */
        function processJsonData(jsonData, lines) {
            lines.push("// JSON data");
            try {
                // If it can be parsed as JSON, show it nicely
                const jsonObj = JSON.parse(jsonData);
                lines.push(`const data = ${JSON.stringify(jsonObj, null, 2)};`);
            } catch (e) {
                // If it can't be parsed, add as string
                lines.push(`const data = ${jsonData};`);
            }
            lines.push("");
        }

        /**
         * Process form data
         * @param {string} formData - Form data string
         * @param {Array} lines - Array of code lines
         */
        function processFormData(formData, lines) {
            lines.push("// Form data (application/x-www-form-urlencoded)");
            lines.push("const urlParams = new URLSearchParams();");

            // Parse form data
            try {
                const formItems = formData.split('&');
                formItems.forEach(item => {
                    if (!item) return;

                    const [key, value] = item.split('=').map(part => {
                        try {
                            return decodeURIComponent(part || '');
                        } catch (e) {
                            return part || '';
                        }
                    });

                    if (key) {
                        lines.push(`urlParams.append('${jsEsc(key)}', '${value ? jsEsc(value) : ""}');`);
                    }
                });
            } catch (e) {
                // Fallback for parsing errors
                lines.push(`// Error parsing form data: ${e.message}`);
                lines.push(`urlParams.append('data', '${jsEsc(formData)}');`);
            }

            lines.push("");
        }

        /**
         * Process plain text data
         * @param {string} textData - Text data string
         * @param {Array} lines - Array of code lines
         */
        function processPlainData(textData, lines) {
            lines.push("// Request data");
            lines.push(`const data = "${jsEsc(textData)}";`);
            lines.push("");
        }

        /**
         * Add body to fetch options based on content type
         * @param {Object} req - Request object
         * @param {Array} lines - Array of code lines
         */
        function addBodyToOptions(req, lines) {
            const hasBody = req.data.ascii || req.data.files || req.data.multipart;
            const isJsonContentType = req.headers.some(h =>
                h.toLowerCase().indexOf('content-type:') !== -1 &&
                h.toLowerCase().indexOf('json') !== -1
            );
            const isFormContentType = req.headers.some(h =>
                h.toLowerCase().indexOf('content-type:') !== -1 &&
                h.toLowerCase().indexOf('form') !== -1
            );

            if (hasBody) {
                if (req.data.multipart || (req.data.files && req.data.files.length > 0)) {
                    lines.push("  body: formData");
                } else if (req.data.ascii) {
                    if (isJsonContentType) {
                        lines.push("  body: JSON.stringify(data)");
                    } else if (isFormContentType) {
                        lines.push("  body: urlParams");
                    } else {
                        lines.push("  body: data");
                    }
                }
            }
        }

        /**
         * Add fetch call and response handling
         * @param {string} url - URL to fetch
         * @param {Array} lines - Array of code lines
         */
        function addFetchCall(url, lines) {
            lines.push("// Send the request using Fetch API");
            lines.push(`fetch('${jsEsc(url)}', options)`);
            lines.push("  .then(response => {");
            lines.push("    if (!response.ok) {");
            lines.push("      throw new Error(`HTTP error! Status: ${response.status}`);");
            lines.push("    }");

            // Determine response type based on Content-Type header
            lines.push("    // Determine response type");
            lines.push("    const contentType = response.headers.get('content-type');");
            lines.push("    if (contentType && contentType.includes('application/json')) {");
            lines.push("      return response.json();");
            lines.push("    } else if (contentType && contentType.includes('text/')) {");
            lines.push("      return response.text();");
            lines.push("    } else if (contentType && contentType.includes('image/')) {");
            lines.push("      return response.blob();");
            lines.push("    }");
            lines.push("    return response.text(); // Return text by default");
            lines.push("  })");
            lines.push("  .then(data => {");
            lines.push("    console.log('Response:', data);");
            lines.push("    return data; // Return the result");
            lines.push("  })");
            lines.push("  .catch(error => {");
            lines.push("    console.error('Error:', error);");
            lines.push("    throw error; // Propagate the error");
            lines.push("  });");
        }
    }

    /**
     * Expand PHP environment variables
     * @param {string} s - String to process
     * @returns {string} Processed string with environment variables
     */
    function phpExpandEnv(s) {
        if (typeof s !== 'string') {
            return "''";
        }

        if (s.indexOf("$") > -1) {
            const replaced = s.replace(/\$/g, "");
            return `$_ENV["${phpEsc(replaced)}"]`;
        }
        return `'${phpEsc(s)}'`;
    }

    /**
     * Escape special characters for PHP strings
     * @param {string} s - String to escape
     * @returns {string} Escaped string
     */
    function phpEsc(s) {
        if (typeof s !== 'string') {
            return '';
        }
        return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    /**
     * Convert string to title case
     * @param {string} str - String to convert
     * @returns {string} Title-cased string
     */
    function toTitleCase(str) {
        if (typeof str !== 'string') {
            return '';
        }
        return str.replace(/\w*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    /**
     * Escape special characters for JavaScript strings
     * @param {string} s - String to escape
     * @returns {string} Escaped string
     */
    function jsEsc(s) {
        if (typeof s !== 'string') {
            return '';
        }
        return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    // Export the curlToCode function for use in browsers and Node.js
    if (typeof window !== "undefined") {
        // Browser environment
        window.curlToCode = curlToCode;

        // Also expose the supported languages if needed
        window.CURL_TO_CODE_LANGUAGES = Object.keys(SUPPORTED_LANGUAGES);
    } else if (typeof module !== "undefined" && module.exports) {
        // Node.js environment
        module.exports = {
            curlToCode,
            supportedLanguages: Object.keys(SUPPORTED_LANGUAGES)
        };
    }
})();
