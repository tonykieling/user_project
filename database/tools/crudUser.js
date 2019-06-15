const userDB = require('../db/userDB.js');
const randomID = require('./randomGen.js');
const { recordLog } = require('./crudLogs.js');
const eventType = require('./eventType.js');
const bcrypt = require('bcrypt');

const Pool = require('pg').Pool;

const pool = new Pool({
  user: 'usersys',
  host: 'localhost',
  database: 'usersys',
  password: 'usersys',
  port: 5432,
});

// auxiliary function to check whether the user (EMAIL) exists in the database
checkUserEmail = email => {
  return new Promise((res, rej) => {
    pool.query('SELECT * FROM users WHERE email = $1', [email], (error, result) => {
      try {
        if (error) {
          recordLog(null, event);
          throw error;
        }
        if (result.rowCount > 0) {
          console.log("checkUserEmail result===> ", result.rows[0].id);
          const { id, name, email, user_admin, user_active } = result.rows[0];
          const user = { id, name, email, user_admin, user_active };
          const event = eventType.check_user_email_success;
          recordLog(user.id, event);
          res(user)
        } else {
          const event = eventType.check_user_email_fail;
          recordLog(null, event);
          res({message: `checkUserEmail - NO user to ${email}!`});
        }
      } catch (err) {
        console.log("checkUserEmail error: ", err.message);
        const event = eventType.check_user_email_fail;
        recordLog(null, event);
        res({message: "Something BAD has happened! Try it again."});
      }
    });
  });
}


// it checks whether the user (email + password) are OK
userQuery = user => {
  // bcrypt.compareSync(password, db[userId.id].password)
  // bcrypt.hashSync(password, 10)
  return new Promise((res, rej) => {
    pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', 
      [user.email, bcrypt.hashSync(user.password, 10)], (error, result) => {
      try {
        if (error) {
          console.log(`userQuery error = ${error.message}`);
          throw error;
        }
        if (result.rowCount > 0) {
          console.log("result===> ", result.rows[0].id);
          const { id, name, email, user_admin, user_active } = result.rows[0];
          const user = { id, name, email, user_admin, user_active };
          res(user)
        } else {
          res({message: "user/password wrong!"});
        }
      } catch (err) {
        console.log("userQuery error: ", err.message);
        res({message: "Something BAD has happened! Try it again."});
      }
    });
  });
}

createUser = async (request, response) => {
  console.log("inside createUser");
  const receivedUser = request.body;
  const { name, email, password } = receivedUser;

  const result = await checkUserEmail(email);
  if (result.id) {
    console.log("id: ", result.id);
    const event = eventType.create_user_fail;
    recordLog(result.id, event);
    response.send({message: `Email ${email} already exists.`});
    return;
  }
////////////////// 60
  pool.query('INSERT INTO users (email, name, password, user_active, user_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, user_active, user_admin', 
    [email, name, bcrypt.hashSync(password, 10), false, false], (error, result) => {
    try {
      if (error) {
        console.log(`createUser error = ${error.message}`);
        throw error;
      }
      const event = eventType.create_user_success;
      const user = result.rows[0];
      recordLog(user.id, event);
      response.send(user);
      return;
    } catch (err) {
      const event = eventType.create_user_fail;
      recordLog(null, event);
      console.log("createUser error: ", err.message);
      response.send({message: "Something BAD has happened! Try it again."});
    }
  });
}

// login method
login = async (request, response) => {
  console.log("inside login method");
  const receivedUser = request.body;
  const result = await userQuery(receivedUser);
  if (result.id) {
    const event = eventType.login_success;
    recordLog(result.id, event);
  }
  else {
    const event = eventType.login_fail;
    recordLog(receivedUser.email, event);
  }

  response.send(result)
}


const readAllUsers = (request, response) => {
console.log("inside getUsers");
  pool.query('SELECT * FROM users ORDER BY id ASC', (error, results) => {
    if (error) {
      response.send("Something bad happened, try it again..")
      throw error
    }
    response.status(200).json(results.rows);
  });
}


// query user by name.
// It's NOT case sensitive due to the 'toLowerCase' invoked function
// it returns the name + email OR false, if it doesn't match
const searchByName = (name) => {
  const db = userDB;
  for (let k in db)
    if (db[k].name.toLowerCase() === name.toLowerCase())
      return { name: db[k].name, email: db[k].email, id: db[k].id };

  return false;
}


// query user by email
// It's NOT case sensitive due to the 'toLowerCase' invoked function
// it returns name + email OR false, if it doesn't match
const searchByEmail = (email) => {
  const db = userDB;
  for (let k in db)
    if (db[k].email.toLowerCase() === email.toLowerCase())
      return { name: db[k].name, email: db[k].email, id: db[k].id } ;

  return false;
}


// it gets the userId searching by their name
// p.s.: it's a very poor criteria because it catchs the first register
// with the specified name
// this function is not supposed to be used, it's better handle the id instead name, but just in case.
const getUserId = (name) => {
  console.log("getuserID, name: ", name)

  const db = userDB;
  for (let k in db) {
    if(db[k].name.toLowerCase() === name.toLowerCase())
      return(db[k].id);
  }
  return false;
}


// this func updates either name or email's user, only for now
// the argument choosed was name
const updateUser = (data) => {
  const userId = data.userId;
  const userDbID = getUserId(userId); // it grabs user's db id

  if (userDbID) {
    const db = userDB;
    const { name, email } = data.user;

    // this option uses spread operator and changes only the data passed after that
    db[userDbID] = { ...db[userDbID], name, email } 
    
    // the option bellow needs to pass each data, more lines to write down..
    // db[userDbID].name = name;
    // db[userDbID].email = email;

    recordLog(userDbID, eventType.update_user);
    return ({status: true,
            message: `User ${db[userDbID].name} has been updated successfully.`,
            user: db[userDbID]});
            // the message also returns the new user data, just in case.
  }

  return {status: false, message: `User ${userId} not found.`};
}




checkPassword = (user) => {
  const { email, password } = user;
  const db = userDB;
  const userId = searchByEmail(email);
  if (!userId) return "NoUser";

  if(bcrypt.compareSync(password, db[userId.id].password)) {
    // req.session.user_id = userId;
  // if (db[userId.id].password === password)
    return {status: true, id: userId.id};
  }
  return {status: false, id: userId.id};
}


logout = (email) => {
  const user = searchByEmail(email);
console.log("user= ", user);
  recordLog(user.id, eventType.logout);
  return (`${user.name} was logouted`);
}


// actually this method deactivate the user
// by setting as true the field deleted
const deleteUser = (nameUser) => {
  const userDbID = getUserId(nameUser); // it grabs user's db id

  if (userDbID) {
    const db = userDB;
    const tempUser = db[userDbID].id;
    // delete db[userDbID];   //old way, without consider login for deleted users
    // new way is
    db[userDbID].deleted = true;
    recordLog(tempUser, eventType.delete_user);
    return ({status: true,
            message: `User ${nameUser} has been deleted successfully.`});
  }

  recordLog(null, eventType.delete_fail)
  return {status: false, message: `User ${nameUser} not found.`};
}

module.exports = {
  readAllUsers,
  login,

  createUser,
  searchByName,
  searchByEmail,
  updateUser,
  deleteUser,
  getUserId,
  logout
}