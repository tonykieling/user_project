const fetch = require('node-fetch');
let url = "", data ="";
let method = "";

if (process.argv[2] === "1") {
  // create user with success
  url = 'http://0.0.0.0:3333/user/new';
  data = {email: 'tao@email.com', password: 'tao', name: "TAO"};

} else if (process.argv[2] === "2") {
  // create user with fail
  url = 'http://0.0.0.0:3333/user/new';
  data = {email: 'tao@email.com', password: 'tao', name: "tao"};

} else if (process.argv[2] === "3") {
  // login user with success
  url = 'http://0.0.0.0:3333/login';
  data = {email: 'tao@email.com', password: 'tao'};

} else if (process.argv[2] === "4") {
  // login user with fail
  url = 'http://0.0.0.0:3333/login';
  data = {email: 'bob@email.com', password: 'tao'};

} else if (process.argv[2] === "5") {
  // login user with fail because not possible empty password
  url = 'http://0.0.0.0:3333/login';
  data = {email: 'bob@email.com', password: ''};
} else if (process.argv[2] === "6") {
  // UPDATE
  url = 'http://0.0.0.0:3333/user';
  data = {id: 1, actualEmail: "tao@email.com", email: 'tao@email.com', name: 'tao', user_active:"true"};
  method = "PUT";
} else if (process.argv[2] === "7") {
  // DELETE/DEACTIVATE
  url = 'http://0.0.0.0:3333/user';
  data = {email: 'tao@email.com'};
  method = "DELETE";
}

fetch(url, {
  method: method || 'POST', // or 'PUT'
  body: JSON.stringify(data), // data can be `string` or {object}!
  headers:{
    'Content-Type': 'application/json'
  }
  })
  .then(res => res.json())
  // .then(response => console.log('### Success:', JSON.stringify(response)))
  .then(console.log)
  .catch(error => console.error('### Error:', error));