import async from "async";
import axios from "axios";
import fs from "node:fs";
import https from "node:https";
import dotenv from 'dotenv';
dotenv.config();

const baseUrl = process.env.BASE_URL;
const urlPath = process.env.URL_PATH;

// dont start appwhen no base url
if (!baseUrl) {
  console.log('No base url provided');
  process.exit(1);
}


function padStringWithZeros(str, max) {
  while (str.length < max) {
    str = `0${str}`;
  }

  return str;
}

/**
 * Generates an array of numbers within a specified range.
 *
 * @param {number} start - The starting number of the range.
 * @param {number} [stop] - The end number of the range (exclusive). If not provided, the range starts at 0 and ends at `start`.
 * @param {number} [step=1] - The increment step between each number in the range. Defaults to 1.
 * @returns {number[]} An array of numbers from `start` to `stop`, incremented by `step`.
 */
function range(start, stop, step = 1) {
  if (typeof stop === "undefined") {
    // one param defined
    stop = start;
    start = 0;
  }

  if (typeof step === "undefined") {
    step = 1;
  }

  if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
    return [];
  }

  const result = [];
  for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
    result.push(i);
  }

  return result;
}

const q = async.queue(({ id }, callback) => {
  const url = `${baseUrl}${urlPath}${id}`;
  console.log("Processing ID:", id, "URL:", url );

  // Making a GET request with custom headers and httpsAgent to bypass SSL certificate validation
  axios
    .get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36",
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    })
    .then(function (response) {
      if (response.status !== 200) {
        console.log(id, "statusCode:", response.status); // Print the response status code if a response was received
        return callback();
      }

      fs.writeFile(`./files/${id}.html`, response.data, (err) => {
        if (err) {
          console.log(id, err);

          setTimeout(() => {
            callback();
          }, Math.floor(Math.random() * 3000) + 1000);

          return;
        }

        // await sleep 0-1 seconds before callback
        setTimeout(() => {
          callback();
        }, Math.floor(Math.random() * 1000));
      });
    })
    .catch(function (error) {
      console.log(`Error fetching URL ${url} for ID ${id}:`, error.toString());

      // await sleep 1-3 seconds before callback
      setTimeout(() => {
        callback();
      }, Math.floor(Math.random() * 3000) + 1000);
    });
}, 2);

async function start() {
  q.drain(() => {
    console.log("All items have been processed.");
  });

  // Loop through the range of 0-50, bulk push 10 tasks to the queue and await until the batch is finished before processing the next 10 tasks
  for (const i of range(0, 50, 10)) {
    const tasks = range(i, i + 10).map((id) => ({
      id: padStringWithZeros(id.toString(), 5),
    }));

    // Push tasks to the queue and wait until all tasks in the batch are finished before continue processing the next batch
    await new Promise((resolve) => {
      let remaining = tasks.length;

      q.push(tasks, () => {
        if (--remaining === 0) {
          resolve();
        }
      });
    });
  }
}

try {
  start();
} catch (error) {
  console.log(error);
}
