// The contents of the Lambda function.

'use strict';
 
exports.handler = async (event) => {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ok: true }),
    };
};