require("dotenv").config();

const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Note = require("../models/Note");
const Post = require("../models/Post");
const connectDB = require("../config/db");

const createdUserIds = [];
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const firstEmail = `verify-a-${suffix}@example.test`;
const secondEmail = `verify-b-${suffix}@example.test`;
const managedEmail = `verify-managed-${suffix}@example.test`;
const password = `Verify-${suffix}-Pass!`;
let server;

async function request(baseUrl, route, { token, method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json;
  try { json = await response.json(); } catch { json = {}; }
  return { status: response.status, json };
}

function checkStatus(result, status, label) {
  assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status} (${result.json.message || "no message"})`);
}

async function main() {
  assert.ok(process.env.MONGO_URI, "MONGO_URI is required");
  assert.ok(process.env.JWT_SECRET, "JWT_SECRET is required");
  assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, "ADMIN_EMAIL and ADMIN_PASSWORD are required for admin workflow checks");

  await connectDB();
  await Promise.all([User.init(), Note.init(), Post.init()]);
  const userIndexes = await User.collection.indexes();
  assert.ok(userIndexes.some(index => index.key.email === 1 && index.unique), "email unique index should be present in MongoDB");
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (const route of [
    "/", "/login.html", "/register.html", "/dashboard.html", "/admin.html",
    "/public-posts.html", "/css/style.css", "/js/api.js", "/js/auth.js",
    "/js/dashboard.js", "/js/admin.js", "/js/public-posts.js"
  ]) {
    checkStatus(await request(baseUrl, route), 200, `frontend asset ${route}`);
  }

  const registrationA = await request(baseUrl, "/api/auth/register", {
    method: "POST", body: { name: "Verify User A", email: firstEmail, password, role: "admin", interests: [`verify-${suffix}`, "reading"] }
  });
  checkStatus(registrationA, 201, "register user A");
  assert.equal(registrationA.json.user.role, "user", "public registration must ignore requested admin role");
  assert.equal(Object.hasOwn(registrationA.json.user, "password"), false, "registration must not return password");
  const tokenA = registrationA.json.token;
  const userAId = registrationA.json.user.id;
  createdUserIds.push(userAId);

  const duplicate = await request(baseUrl, "/api/auth/register", {
    method: "POST", body: { name: "Duplicate", email: firstEmail, password }
  });
  checkStatus(duplicate, 409, "duplicate email");
  checkStatus(await request(baseUrl, "/api/auth/login", { method: "POST", body: { email: firstEmail, password: "incorrect-password" } }), 401, "invalid password");

  const registrationB = await request(baseUrl, "/api/auth/register", {
    method: "POST", body: { name: "Verify User B", email: secondEmail, password, interests: [`verify-${suffix}`] }
  });
  checkStatus(registrationB, 201, "register user B");
  const tokenB = registrationB.json.token;
  const userBId = registrationB.json.user.id;
  createdUserIds.push(userBId);

  checkStatus(await request(baseUrl, "/api/notes"), 401, "missing token");
  checkStatus(await request(baseUrl, "/api/notes", { token: "not.a.valid.token" }), 401, "invalid token");
  checkStatus(await request(baseUrl, "/api/admin/users", { token: tokenA }), 403, "user blocked from admin API");
  checkStatus(await request(baseUrl, "/api/posts", { method: "POST", body: { title: "No token", content: "Must be rejected" } }), 401, "post creation requires authentication");

  const loginA = await request(baseUrl, "/api/auth/login", { method: "POST", body: { email: firstEmail, password } });
  checkStatus(loginA, 200, "login user A");
  assert.equal(Object.hasOwn(loginA.json.user, "password"), false, "login must not return password");
  const storedA = await User.findById(userAId).select("+password").lean();
  assert.notEqual(storedA.password, password, "stored password must be hashed");
  assert.match(storedA.password, /^\$2[aby]\$/i, "stored password must be bcrypt hashed");

  const note = await request(baseUrl, "/api/notes", { token: tokenA, method: "POST", body: { title: "Verification note", content: "Created by API verification" } });
  checkStatus(note, 201, "create note");
  const noteId = note.json.data._id;
  const ownList = await request(baseUrl, "/api/notes?page=1&limit=1", { token: tokenA });
  checkStatus(ownList, 200, "list own notes");
  assert.ok(ownList.json.pagination && ownList.json.data.some(item => item._id === noteId), "own notes list should include created note and pagination");
  checkStatus(await request(baseUrl, `/api/notes/${noteId}`, { token: tokenA }), 200, "read own note");
  checkStatus(await request(baseUrl, `/api/notes/${noteId}`, { token: tokenB }), 404, "other user cannot read note");
  checkStatus(await request(baseUrl, `/api/notes/${noteId}`, { token: tokenB, method: "PUT", body: { title: "Unauthorized edit" } }), 404, "other user cannot update note");
  checkStatus(await request(baseUrl, `/api/notes/${noteId}`, { token: tokenB, method: "DELETE" }), 404, "other user cannot delete note");
  checkStatus(await request(baseUrl, `/api/notes/not-an-object-id`, { token: tokenA }), 400, "invalid note id");
  const updatedNote = await request(baseUrl, `/api/notes/${noteId}`, { token: tokenA, method: "PUT", body: { title: "Updated verification note" } });
  checkStatus(updatedNote, 200, "update own note");

  const plan = await Note.find({ userId: new mongoose.Types.ObjectId(userAId) })
    .sort({ createdAt: -1, _id: -1 }).limit(10).explain("executionStats");
  const usesIndex = JSON.stringify(plan.queryPlanner.winningPlan).includes("IXSCAN");
  assert.ok(usesIndex, "own-note pagination should use a declared index");
  assert.equal(typeof plan.executionStats.totalDocsExamined, "number");
  assert.equal(typeof plan.executionStats.totalKeysExamined, "number");

  const createdPost = await request(baseUrl, "/api/posts", { token: tokenA, method: "POST", body: { title: "Verification post", content: "Public post" } });
  checkStatus(createdPost, 201, "create post");
  const publicFeed = await request(baseUrl, "/api/posts?page=1&limit=100");
  checkStatus(publicFeed, 200, "public posts without authentication");
  assert.ok(publicFeed.json.data.some(post => post._id === createdPost.json.data._id), "public feed should include post");
  assert.ok(publicFeed.json.data.find(post => post._id === createdPost.json.data._id).userId.name, "public feed should include author name");
  assert.ok(publicFeed.json.pagination, "public feed should include pagination");
  const publicProfile = await request(baseUrl, `/api/aggregation/users/${userAId}/posts`);
  checkStatus(publicProfile, 200, "public user posts aggregation");
  assert.ok(publicProfile.json.data.posts.some(post => post._id === createdPost.json.data._id), "$lookup should return the user's post");
  checkStatus(await request(baseUrl, "/public-posts.html"), 200, "public posts page");
  checkStatus(await request(baseUrl, "/js/public-posts.js"), 200, "public posts frontend script");

  const adminLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST", body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }
  });
  checkStatus(adminLogin, 200, "admin login");
  const adminToken = adminLogin.json.token;
  const adminId = adminLogin.json.user.id;
  const adminUsers = await request(baseUrl, "/api/admin/users?page=1&limit=5", { token: adminToken });
  checkStatus(adminUsers, 200, "admin paginated users");
  assert.ok(adminUsers.json.pagination, "admin user list should include pagination");
  assert.ok(adminUsers.json.data.every(item => !Object.hasOwn(item, "password")), "admin user list must not expose password");

  const managed = await request(baseUrl, "/api/admin/users", {
    token: adminToken, method: "POST",
    body: { name: "Managed Verification User", email: managedEmail, password: `Managed-${suffix}-Pass!`, role: "user", interests: [`verify-managed-${suffix}`] }
  });
  checkStatus(managed, 201, "admin create user");
  const managedId = managed.json.data.id;
  createdUserIds.push(managedId);
  const managedUpdate = await request(baseUrl, `/api/admin/users/${managedId}`, {
    token: adminToken, method: "PUT", body: { name: "Updated Managed User", interests: [`verify-managed-${suffix}`, "books"] }
  });
  checkStatus(managedUpdate, 200, "admin update user");

  const adminNotes = await request(baseUrl, "/api/admin/notes?page=1&limit=10", { token: adminToken });
  checkStatus(adminNotes, 200, "admin paginated notes");
  assert.ok(adminNotes.json.pagination, "admin notes should include pagination");
  const ownedAdminNote = adminNotes.json.data.find(item => item._id === noteId);
  assert.equal(ownedAdminNote?.userId?.email, firstEmail, "admin note list should show owner email");

  const firstGroups = await request(baseUrl, "/api/aggregation/interests?page=1&limit=1", { token: adminToken });
  checkStatus(firstGroups, 200, "paginated interest aggregation");
  assert.ok(firstGroups.json.pagination && typeof firstGroups.json.pagination.total === "number", "interest aggregation should include pagination metadata");
  const allInterestGroups = [];
  const groupPages = Math.ceil(firstGroups.json.pagination.total / 100);
  for (let current = 1; current <= groupPages; current++) {
    const groupPage = await request(baseUrl, `/api/aggregation/interests?page=${current}&limit=100`, { token: adminToken });
    checkStatus(groupPage, 200, `interest aggregation page ${current}`);
    allInterestGroups.push(...groupPage.json.data);
  }
  assert.ok(allInterestGroups.some(group => group.interest === `verify-${suffix}`), "interest aggregation should include registered users' interest");

  const managedLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST", body: { email: managedEmail, password: `Managed-${suffix}-Pass!` }
  });
  checkStatus(managedLogin, 200, "login admin-created user");
  const managedNote = await request(baseUrl, "/api/notes", { token: managedLogin.json.token, method: "POST", body: { title: "Cascade note", content: "Will be removed with user" } });
  checkStatus(managedNote, 201, "create managed user's note");
  const deletedManaged = await request(baseUrl, `/api/admin/users/${managedId}`, { token: adminToken, method: "DELETE" });
  checkStatus(deletedManaged, 200, "admin delete user");
  assert.equal(await User.exists({ _id: managedId }), null, "admin delete should remove the user");
  assert.equal(await Note.exists({ _id: managedNote.json.data._id }), null, "admin delete should remove the user's notes");
  createdUserIds.splice(createdUserIds.indexOf(managedId), 1);

  checkStatus(await request(baseUrl, `/api/admin/users/${adminId}`, { token: adminToken, method: "DELETE" }), 400, "admin cannot delete own account");
  const deletedNote = await request(baseUrl, `/api/notes/${noteId}`, { token: tokenA, method: "DELETE" });
  checkStatus(deletedNote, 200, "delete own note");

  const invalidProfileId = await request(baseUrl, "/api/aggregation/users/not-an-object-id/posts");
  checkStatus(invalidProfileId, 400, "invalid public profile id");

  console.log("API verification passed: auth, authorization, notes, pagination, admin CRUD, interests aggregation, public posts, and $lookup.");
  console.log(`Note pagination explain: nReturned=${plan.executionStats.nReturned}, totalKeysExamined=${plan.executionStats.totalKeysExamined}, totalDocsExamined=${plan.executionStats.totalDocsExamined}, usesIndex=${usesIndex}`);
}

main()
  .catch(error => {
    console.error("API verification failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (createdUserIds.length && mongoose.connection.readyState === 1) {
      const ids = createdUserIds.map(id => new mongoose.Types.ObjectId(id));
      await Promise.all([
        Note.deleteMany({ userId: { $in: ids } }),
        Post.deleteMany({ userId: { $in: ids } })
      ]);
      await User.deleteMany({ _id: { $in: ids } });
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
