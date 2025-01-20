(function () {
    function curlToCode(lang, curlInput) {
        if (!curlInput || !curlInput.trim()) {
            return "";
        }
        var cmd = parseCommand(curlInput, {boolFlags: boolOptions});
        if (cmd._[0] !== "curl") {
            throw "Invalid cURL command.";
        }
        var req = extractRelevantPieces(cmd);
        if (!req.method) req.method = "GET";
        switch (lang.toLowerCase()) {
            case "php":
                return buildPhp(req);
            case "js":
                return buildJs(req);
            default:
                throw "Desteklenmeyen dil: " + lang;
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
        var result = {_: []};
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

    function buildPhp(req) {
        var start = "$ch = curl_init();\n\n";
        var resultCall = "$result = curl_exec($ch);\n";
        var errCheck = "if (curl_errno($ch)) {\n  echo 'Error: ' . curl_error($ch);\n}\n";
        var closeCurl = "curl_close($ch);\n";
        var code = start;
        code += "curl_setopt($ch, CURLOPT_URL, " + phpExpandEnv(req.url) + ");\n";
        code += "curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n\n";
        if (
            req.headers.length === 0 &&
            !req.data.ascii &&
            !req.data.files &&
            !req.data.multipart &&
            !req.basicauth &&
            !req.compressed
        ) {
            code += renderSimple(req.method);
        } else {
            code += renderComplex(req);
        }
        return code;

        function renderSimple(method) {
            let php = "";
            if (method === "POST") {
                php += "curl_setopt($ch, CURLOPT_POST, 1);\n";
            } else if (method === "HEAD") {
                php += "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'HEAD');\n";
                php += "curl_setopt($ch, CURLOPT_NOBODY, true);\n";
            } else if (method !== "GET") {
                php += "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, " + phpExpandEnv(method) + ");\n";
            }
            php += "\n" + resultCall + errCheck + closeCurl;
            return php;
        }

        function renderComplex(r) {
            let php = "";
            let headersMap = {};
            for (let i = 0; i < r.headers.length; i++) {
                let splitIndex = r.headers[i].indexOf(":");
                if (splitIndex === -1) continue;
                let hName = r.headers[i].substr(0, splitIndex).trim();
                let hVal = r.headers[i].substr(splitIndex + 1).trim();
                headersMap[toTitleCase(hName)] = hVal;
            }
            if (r.method === "POST") {
                php += "curl_setopt($ch, CURLOPT_POST, 1);\n";
            } else if (r.method === "HEAD") {
                php += "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'HEAD');\n";
                php += "curl_setopt($ch, CURLOPT_NOBODY, true);\n";
            } else if (r.method !== "GET") {
                php += "curl_setopt($ch, CURLOPT_CUSTOMREQUEST, " + phpExpandEnv(r.method) + ");\n";
            }
            if (r.data.ascii || r.data.files || r.data.multipart) {
                let postItems = [];
                if (r.data.ascii) {
                    let isJson = (headersMap["Content-type"] && headersMap["Content-type"].toLowerCase().indexOf("json") >= 0);
                    if (isJson) {
                        postItems.push(JSON.stringify(r.data.ascii));
                    } else {
                        postItems.push("'" + phpEsc(r.data.ascii) + "'");
                    }
                }
                if (r.data.files && r.data.files.length > 0) {
                    r.data.files.forEach((filePath, idx) => {
                        let fieldName = "file" + (idx + 1);
                        let snippet = "'" + fieldName + "' => new CURLFile(realpath(" + phpExpandEnv(filePath) + "))";
                        postItems.push(snippet);
                    });
                }
                if (r.data.multipart && r.data.multipart.length > 0) {
                    r.data.multipart.forEach(part => {
                        let eqIndex = part.indexOf("=");
                        if (eqIndex > -1) {
                            let argName = part.substr(0, eqIndex).trim();
                            let argValue = part.substr(eqIndex + 1).trim();
                            if (argValue.startsWith("@")) {
                                let filePath = argValue.substr(1);
                                postItems.push("'" + argName + "' => new CURLFile(realpath(" + phpExpandEnv(filePath) + "))");
                            } else {
                                postItems.push("'" + argName + "' => " + phpExpandEnv(argValue));
                            }
                        }
                    });
                }
                if (postItems.length === 1 && !r.data.multipart) {
                    php += "curl_setopt($ch, CURLOPT_POSTFIELDS, " + postItems[0] + ");\n";
                } else if (postItems.length > 0) {
                    php += "$postData = array(\n  " + postItems.join(",\n  ") + "\n);\n";
                    php += "curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);\n";
                }
            }
            if (r.basicauth) {
                php += "curl_setopt($ch, CURLOPT_USERPWD, " + phpExpandEnv(r.basicauth.user) + " . ':' . " + phpExpandEnv(r.basicauth.pass) + ");\n";
            }
            if (r.compressed) {
                php += "curl_setopt($ch, CURLOPT_ENCODING, 'gzip, deflate');\n";
            }
            let headerLines = [];
            for (let h in headersMap) {
                headerLines.push("'" + h + ": " + headersMap[h] + "'");
            }
            if (headerLines.length > 0) {
                php += "\n$headers = array(\n  " + headerLines.join(",\n  ") + "\n);\n";
                php += "curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);\n";
            }
            php += "\n" + resultCall + errCheck + closeCurl;
            return php;
        }
    }

    function buildJs(req) {
        var method = req.method.toLowerCase();
        var lines = [];
        lines.push("const axios = require('axios');");
        lines.push("const config = {");
        lines.push("  method: '" + method + "',");
        lines.push("  url: '" + jsEsc(req.url) + "',");
        if (req.headers && req.headers.length > 0) {
            var mappedHeaders = {};
            req.headers.forEach(function (h) {
                var splitIndex = h.indexOf(":");
                if (splitIndex !== -1) {
                    var name = h.substr(0, splitIndex).trim();
                    var val = h.substr(splitIndex + 1).trim();
                    mappedHeaders[name] = val;
                }
            });
            var headersSnippet = JSON.stringify(mappedHeaders, null, 2);
            lines.push("  headers: " + headersSnippet + ",");
        }
        if (req.basicauth) {
            lines.push("  auth: {");
            lines.push("    username: '" + jsEsc(req.basicauth.user) + "',");
            lines.push("    password: '" + jsEsc(req.basicauth.pass) + "'");
            lines.push("  },");
        }
        if (req.data.ascii || req.data.files || req.data.multipart) {
            var dataPart = "";
            if (req.data.ascii) {
                dataPart = req.data.ascii;
            }
            lines.push("  data: \"" + jsEsc(dataPart) + "\",");
        }
        lines.push("};");
        lines.push("");
        lines.push("axios(config)");
        lines.push("  .then(response => {");
        lines.push("    console.log(response.data);");
        lines.push("  })");
        lines.push("  .catch(error => {");
        lines.push("    console.error(error);");
        lines.push("  });");
        return lines.join("\n");
    }

    function phpExpandEnv(s) {
        if (s.indexOf("$") > -1) {
            let replaced = s.replace(/\$/g, "");
            return '$_ENV["' + phpEsc(replaced) + '"]';
        }
        return "'" + phpEsc(s) + "'";
    }

    function phpEsc(s) {
        return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    function toTitleCase(str) {
        return str.replace(/\w*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    function jsEsc(s) {
        return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    if (typeof window !== "undefined") {
        window.curlToCode = curlToCode;
    } else if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            curlToCode
        };
    }
})();