/*** Code Dependencies ***/
const { Storage } = require("@google-cloud/storage");
const httpRequest = require("request");
const crypto = require("crypto");

const FILE_EXTENSION = new RegExp(/(.*)\.(.*)$/);

/*** Load & validate configs ***/
const { CALLBACK_URL_PREFIX, LOOKER_SECRET } = process.env;
warnIf(check_LOOKER_SECRET());
warnIf(check_CALLBACK_URL_PREFIX());

/*** Entry-point for requests ***/
exports.httpHandler = async function httpHandler(req, res) {
  const routes = {
    "/": [hubListing],
    "/action-0/form": [requireInstanceAuth, action0Form],
    "/action-0/execute": [requireInstanceAuth, action0Execute],
    "/status": [hubStatus], // Debugging endpoint
  };
  try {
    const routeHandlers = routes[req.path] || [routeNotFound];
    req.state = tryJsonParse(
      req.body && req.body.data && req.body.data.state_json,
      {}
    );
    for (let handler of routeHandlers) {
      let handlerResponse = await handler(req, res);
      if (!handlerResponse) continue;
      return res
        .status(handlerResponse.status || 200)
        .type(handlerResponse.type || "json")
        .set(handlerResponse.headers || {})
        .send(handlerResponse.body || handlerResponse);
    }
    return;
  } catch (err) {
    console.error(err);
    res.status(500).json("Unexpected error");
  }
};

/* Definitions for route handler functions */
async function requireInstanceAuth(req) {
  const lookerSecret = LOOKER_SECRET;
  if (!lookerSecret) {
    return;
  }
  const expectedAuthHeader = `Token token="${lookerSecret}"`;
  if (!timingSafeEqual(req.headers.authorization, expectedAuthHeader)) {
    return {
      status: 401,
      body: { error: "Looker instance authentication is required" },
    };
  }
}

async function hubListing(req) {
  // https://github.com/looker/actions/blob/master/docs/action_api.md#actions-list-endpoint
  return {
    integrations: [
      {
        name: "upload-gcs",
        label: "Upload GCS",
        description: "Write data files to a Google Cloud Storage bucket.",
        icon_data_uri:
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMS43Nzc4aW4iIGhlaWdodD0iMS43Nzc4aW4iIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSI2My45OTk3IiB5MT0iMTIyLjk2NjQiIHgyPSI2My45OTk3IiB5Mj0iOS4yMTA2IiBncmFkaWVudFRyYW5zZm9ybT0ibWF0cml4KDEsIDAsIDAsIC0xLCAwLCAxMzApIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjNDM4N2ZkIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNDY4M2VhIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHRpdGxlPkFydGJvYXJkIDEtY3JvcDwvdGl0bGU+PHBhdGggZD0iTTI3Ljc5MDYsMTE1LjIxNjYsMS41NCw2OS43NDkzYTExLjQ5OSwxMS40OTksMCwwLDEsMC0xMS40OTlMMjcuNzkwNiwxMi43ODMxYTExLjQ5OTEsMTEuNDk5MSwwLDAsMSw5Ljk1ODUtNS43NDk1SDkwLjI1YTExLjQ5OTEsMTEuNDk5MSwwLDAsMSw5Ljk1ODUsNS43NDk1TDEyNi40NTk0LDU4LjI1YTExLjQ5OSwxMS40OTksMCwwLDEsMCwxMS40OTlsLTI2LjI1MDYsNDUuNDY3MkExMS40OTkxLDExLjQ5OTEsMCwwLDEsOTAuMjUsMTIwLjk2NkgzNy43NDkxQTExLjQ5ODksMTEuNDk4OSwwLDAsMSwyNy43OTA2LDExNS4yMTY2WiIgZmlsbD0idXJsKCNhKSIvPjxwYXRoIGQ9Ik04NS40ODgsNTAuNTUsNDkuMzEyNSw1My44NzQ5bC03LjAxLDYuOTlMNDguMjYsNjYuODIyOCw0Mi4zNjIsNzcuMjk5NCw4Ni4wMjg2LDEyMC45NjZoNC4yMjJhMTEuNDk5MSwxMS40OTkxLDAsMCwwLDkuOTU4NS01Ljc1TDExOC40OSw4My41NTI2WiIgb3BhY2l0eT0iMC4wNyIgc3R5bGU9Imlzb2xhdGlvbjppc29sYXRlIi8+PHBhdGggZD0iTTg0LjcsNTAuMjY5MWwtNDEuNDM2LjAwMTJhMS4yMTYzLDEuMjE2MywwLDAsMC0xLjIxMjksMS4yMTI5bC4wMDEyLDguNTY2M2ExLjIxNiwxLjIxNiwwLDAsMCwxLjIxMTcsMS4yMTE3SDg0LjY5ODhhMS4yMTYxLDEuMjE2MSwwLDAsMCwxLjIxMjgtMS4yMTE3VjUxLjQ4MkExLjIxNjMsMS4yMTYzLDAsMCwwLDg0LjcsNTAuMjY5MW0tNi40MTYsNy45NzUxYTIuNDc4NCwyLjQ3ODQsMCwxLDEsMi40NzkxLTIuNDgsMi40ODM5LDIuNDgzOSwwLDAsMS0yLjQ3OTEsMi40OCIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik04NC43LDY2LjczNjFsLTQxLjQzNi4wMDEyYTEuMjE3MSwxLjIxNzEsMCwwLDAtMS4yMTI5LDEuMjE0NmwuMDAxMiw4LjU2NDZhMS4yMTcsMS4yMTcsMCwwLDAsMS4yMTE3LDEuMjEyOUg4NC42OTg4YTEuMjE3MiwxLjIxNzIsMCwwLDAsMS4yMTI4LTEuMjEyOVY2Ny45NUExLjIxNjksMS4yMTY5LDAsMCwwLDg0LjcsNjYuNzM2MW0tNi40MTYsNy45NzUyYTIuNDc4MSwyLjQ3ODEsMCwxLDEsMi40NzkxLTIuNDgsMi40ODM1LDIuNDgzNSwwLDAsMS0yLjQ3OTEsMi40OCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==",
        supported_action_types: ["query", "dashboard"],
        supported_download_settings: ["url"],
        form_url: `${process.env.CALLBACK_URL_PREFIX}/action-0/form`,
        url: `${process.env.CALLBACK_URL_PREFIX}/action-0/execute`,
        supported_formats: ["csv", "csv_zip"],
        supported_formattings: ["unformatted"],
        params: [
          {
            name: "client_email",
            label: "Client Email",
            required: true,
            sensitive: false,
            description:
              "Your client email for GCS from https://console.cloud.google.com/apis/credentials",
          },
          {
            name: "private_key",
            label: "Private Key",
            required: true,
            sensitive: true,
            description:
              "Your private key for GCS from https://console.cloud.google.com/apis/credentials",
          },
          {
            name: "project_id",
            label: "Project Id",
            required: true,
            sensitive: false,
            description:
              "The Project Id for your GCS project from https://console.cloud.google.com/apis/credentials",
          },
        ],
      },
    ],
  };
}

async function action0Form(req, res) {
  // https://github.com/looker/actions/blob/master/docs/action_api.md#action-form-endpoint
  const project_id = req.body.data.project_id;
  const private_key = req.body.data.private_key.replace(/\\n/g, "\n");
  const client_email = req.body.data.client_email;
  const gcs = gcsClientFromRequest(project_id, private_key, client_email);
  let results;

  try {
    results = await gcs.getBuckets();
  } catch (e) {
    results = [];
  }

  const buckets = results[0];

  return [
    {
      label: "Bucket",
      name: "bucket",
      required: true,
      options: buckets.map((b) => {
        return { name: b.id, label: b.name };
      }),
      type: "select",
      default: buckets[0].id,
    },
    {
      label: "Filename",
      name: "filename",
      type: "string",
    },
    {
      label: "Overwrite",
      name: "overwrite",
      type: "select",
      options: [
        { label: "Yes", name: "yes" },
        { label: "No", name: "no" },
      ],
      default: "yes",
      description:
        "If Overwrite is enabled, will use the title or filename and overwrite existing data." +
        " If disabled, a date time will be appended to the name to make the file unique.",
    },
  ];
}

async function action0Execute(req) {
  const project_id = req.body.data.project_id;
  const private_key = req.body.data.private_key.replace(/\\n/g, "\n");
  const client_email = req.body.data.client_email;
  const bucket = req.body.form_params.bucket;
  const overwrite = req.body.form_params.overwrite;
  let filename = req.body.form_params.filename;
  const url = req.body.scheduled_plan.download_url;
  const gcs = gcsClientFromRequest(project_id, private_key, client_email);
  const file = gcs.bucket(bucket).file(filename);
  const writeStream = file.createWriteStream();

  if (!bucket) {
    throw "Need Google Cloud Storage bucket.";
  }

  // If the overwrite formParam exists and it is "no" - ensure a timestamp is appended
  if (overwrite && overwrite === "no") {
    const captures = filename.match(FILE_EXTENSION);
    if (captures && captures.length > 1) {
      filename = captures[1] + `_${Date.now()}.` + captures[2];
    } else {
      filename += `_${Date.now()}`;
    }
  }

  if (!filename) {
    throw new Error("Couldn't determine filename.");
  }

  try {
    results = await stream(url, writeStream);
    return { success: true };
  } catch (e) {
    return { success: false, body: e.message };
  }
}

async function hubStatus(req) {
  return {
    validation: {
      callbackUrlPrefix: check_CALLBACK_URL_PREFIX() || "ok",
      lookerSecret: check_LOOKER_SECRET() || "ok",
    },
    configuration: {
      callbackUrlPrefix: process.env.CALLBACK_URL_PREFIX,
    },
    function: {
      FUNCTION_TARGET: process.env.FUNCTION_TARGET,
      K_SERVICE: process.env.K_SERVICE,
      K_REVISION: process.env.K_REVISION,
      PORT: process.env.PORT,
    },
    services: {},
    received: {
      method: req.method,
      path: req.path,
      query: req.query,
      headers: req.headers,
      body: req.body,
    },
  };
}

function routeNotFound() {
  return {
    status: 400,
    type: "text",
    body: "Invalid request",
  };
}

/* Check definitions */
function check_LOOKER_SECRET() {
  if (!LOOKER_SECRET) {
    return "Function is not requiring authentication. Provide a LOOKER_SECRET to require authentication";
  }
}
function check_CALLBACK_URL_PREFIX() {
  if (!CALLBACK_URL_PREFIX) {
    return "CALLBACK_URL_PREFIX is not defined";
  }
}

/* Helper functions */
async function warnIf(strOrPromise) {
  let str = await strOrPromise;
  if (str) {
    console.warn(`WARNING: ${str}`);
  }
}
async function exitIf(strOrPromise) {
  let str = await strOrPromise;
  if (str) {
    console.error(str);
    process.exit(1);
  }
}
function timingSafeEqual(a, b) {
  if (typeof a !== "string") {
    throw "String required";
  }
  if (typeof b !== "string") {
    throw "String required";
  }
  let aLen = Buffer.byteLength(a);
  let bLen = Buffer.byteLength(b);
  const bufA = Buffer.allocUnsafe(aLen);
  bufA.write(a);
  const bufB = Buffer.allocUnsafe(aLen); //Yes, aLen
  bufB.write(b);

  return crypto.timingSafeEqual(bufA, bufB) && aLen === bLen;
}
function tryJsonParse(str, dft) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return dft;
  }
}
function gcsClientFromRequest(project_id, private_key, client_email) {
  try {
    const credentials = {
      client_email: client_email,
      private_key: private_key,
    };
    const config = {
      projectId: project_id,
      credentials,
    };
    return new Storage(config);
  } catch (e) {
    throw e;
  }
}
async function stream(url, writeStream) {
  const timeout = 13 * 60 * 1000;

  const streamPromise = new Promise((resolve, reject) => {
    let hasResolved = false;
    httpRequest
      .get(url, { timeout })
      .on("error", (err) => {
        if (hasResolved && err.code === "ECONNRESET") {
        } else {
          reject(err);
        }
      })
      .on("finish", () => {})
      .on("socket", (socket) => {
        socket.setKeepAlive(true);
      })
      .on("abort", () => {})
      .on("response", () => {})
      .on("close", () => {})
      .pipe(writeStream)
      .on("error", (err) => {
        reject(err);
      })
      .on("finish", () => {
        resolve();
        hasResolved = true;
      })
      .on("close", () => {});
  });

  const results = await Promise.all([streamPromise]);
  return results[0];
}
