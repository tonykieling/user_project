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
// it receives user email
// it returns an object either {id, name, email, user_admin, user_active} OR message (if it fails)
checkUserByEmail= email => {
  console.log("### inside checkuserbyemail");
  return new Promise((res, rej) => {
    pool.query('SELECT * FROM users WHERE email = $1', [email], (error, result) => {
      try {
        if (error) {
          throw error;
        }
        if (result.rowCount > 0) {
          const { id, name, email, user_admin, user_active } = result.rows[0];
          const user = { id, name, email, user_admin, user_active };
          const event = eventType.check_user_email_success;
          recordLog(user.id, event);
          res(user);
        } else {
          const event = eventType.check_user_email_fail;
          recordLog(email, event);
          res({message: `checkUserByEmail - NO user to ${email}!`});
        }
      } catch (err) {
        console.log("checkUserByEmail error: ", err.message);
        const event = eventType.check_user_email_fail;
        recordLog(null, event);
        rej({message: "Something BAD has happened! Try it again."});
      }
    });
  });
}


// it checks whether the user (email + password) are OK
// it receives user email and password inside user variable
// it returns an object either {id, name, email, user_admin, user_active} OR message (if it fails)
userQuery = user => {
  console.log("### inside userQuery");
  return new Promise((res, rej) => {
    // the query can be replaced for checkUserByEmail
    // tryed but no success because it needs to be async.
    // tryed async before user and inside Promise, but NO success
    pool.query('SELECT * FROM users WHERE email = $1', [user.email], (error, result) => {
      try {
        if (error) {
          console.log(`userQuery error = ${error.message}`);
          throw error;
        }
        if (result.rowCount > 0) {
          const userFromQuery = result.rows[0];
          if(bcrypt.compareSync(user.password, userFromQuery.password)){
            const event = eventType.login_success;
            recordLog(user.email, event);
            res({
              id: userFromQuery.id,
              email: userFromQuery.email,
              name: userFromQuery.name,
              userActive: userFromQuery.user_active,
              userAdmin: userFromQuery.user_admin
            });
          } else {
            const event = eventType.login_fail;
            recordLog(user.email, event);
            res({message: "user/password wrong!"});
          }
        } else {
          const event = eventType.login_fail;
          recordLog(user.email, event);
          res({message: "### user/password wrong!"});
        }
      } catch (err) {
        console.log("userQuery error: ", err.message);
        const event = eventType.login_fail;
        recordLog(user.email, event);
        res({message: "Something BAD has happened! Try it again."});
      }
    });
  });
}



// login method
// it receives user data to be logged through request(with data inside body)
// it returns an object either {id, name, email, user_admin, user_active} OR message (if it fails)
login = async (request, response) => {
  console.log("### inside login method");
  const receivedUser = request.body;
  const result = await userQuery(receivedUser);
  if (result.id) {
    const event = eventType.login_success;
    recordLog(result.id, event);
  } else {
    const event = eventType.login_fail;
    recordLog(receivedUser.email, event);
  }
  response.send(result)
}


// create user method
// it receives user data to be created through request(with data inside body)
// it returns an object either {id, name, email, user_admin, user_active} OR message (if it fails)
createUser = async (request, response) => {
  console.log("### inside createUser");
  const receivedUser = request.body;
  const { name, email, password } = receivedUser;

  const result = await checkUserByEmail(email);
  if (result.id) {
    const event = eventType.create_user_fail;
    recordLog(result.id, event);
    response.send({message: `Email ${email} already exists.`});
    return;
  }

  pool.query('INSERT INTO users (email, name, password, user_active, user_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, user_active, user_admin',
    [email, name, bcrypt.hashSync(password, 10), true, false], (error, result) => {
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
        recordLog("system", event);
        console.log("createUser error: ", err.message);
        response.send({message: "Something BAD has happened! Try it again."});
      }
    });
}


// this methos updates user info
// it receives user id and the data to be changed through request(with data inside body)
// it returns an object either {id, name, email, user_admin, user_active} OR message (if it fails)
updateUser = async (request, response) => {
  console.log("### inside updateUser");
  // const { id, email, name, actualEmail, user_active, user_admin } = request.body;
  const receivedUser = request.body;
    const result = await checkUserByEmail(receivedUser.email);
    if (result.id) {
      if ("newPassword" in receivedUser) {
        const loginUser = await userQuery(receivedUser);
        if ("email" in loginUser) {
          pool.query(
            'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email, name, user_active, user_admin',
            [bcrypt.hashSync(receivedUser.newPassword, 10) , result.id],
            (error, result) => {
              try {
                if (error) {
                  console.log(`updateUser error = ${error.message}`);
                  throw error;
                }
                const event = eventType.change_password_sucess;
                const user = result.rows[0];
                recordLog(user.id, event);
                response.send(user);
                return;
              } catch (err) {
                const event = eventType.change_password_fail;
                recordLog(null, event);
                console.log("updateUser error: ", err.message);
                response.send({message: "Something BAD has happened! Try it again."});
                return;
              }
            });
          } else {
            response.send(loginUser);
            return;
          }
      } else {
        pool.query(
          'UPDATE users SET email = $1, name = $2, user_active = $3, user_admin = $4 WHERE id = $5 RETURNING id, email, name, user_active, user_admin',
          [receivedUser.email, receivedUser.name, receivedUser.user_active || true, receivedUser.user_admin || false, result.id],
          (error, result) => {
            try {
              if (error) {
                console.log(`updateUser error = ${error.message}`);
                throw error;
              }
              const event = eventType.update_user_success;
              const user = result.rows[0];
              recordLog(user.id, event);
              response.send(user);
              return;
            } catch (err) {
              const event = eventType.update_user_fail;
              recordLog(null, event);
              console.log("updateUser error: ", err.message);
              response.send({message: "Something BAD has happened! Try it again."});
              return;
            }
          });
        }
    } else {
      const event = eventType.create_user_fail;
      recordLog("system", event);
      console.log("something wrong with update");
      response.send({message: "Error - UPDATE"});
    }
}

// actually this method deactivate the user by setting as false the field user_active
// it only is performed by admin users
// it receives user's email
// it returns an object either {id, name, email, user_admin, user_active} OR message (if it fails)
deleteUser = async (request, response) => {
  console.log("### inside deactivateUser");
  const { email } = request.body;
  const result = await checkUserByEmail(email);
  if (result.id) {
    pool.query(
      'UPDATE users SET user_active = $1 WHERE id = $2 RETURNING id, email, name, user_active, user_admin',
      [false, result.id], (error, result) => {
      try {
        if (error) {
          console.log(`deactivateUser error = ${error.message}`);
          throw error;
        }
        const event = eventType.deactivate_user_success;
        const user = result.rows[0];
        recordLog(user.id, event);
        response.send(user);
        return;
      } catch (err) {
        const event = eventType.deactivate_user_fail;
        recordLog(null, event);
        console.log("deactivateUser error: ", err.message);
        response.send({message: "Something BAD has happened! Try it again."});
      }
    });
  } else {
    console.log("something wrong with deactate user");
    response.send({message: "Error - DEACTIVATE USER"});
  }
}


module.exports = {
  login,
  createUser,
  updateUser,
  deleteUser
};
