/*
* newHandler.js
 */

"use strict";

var log = require('./../log');
var DBRow = require('./../DBRow').DBRow;
var lit = require('./../Literals');
var voter = require('./../actions/Voter');
var contributor = require('./../actions/Contributor');

/** Handles the insertion of new items into the database that were sent from the new page. Can create links, questions,
 * and classes. Additionally, inserts a new vote, contribution and item table entry that corresponds to the new item.
 *
 * @param request: The express request received by the express server
 * @returns {*}: void
 */
exports.handle = function(request) {
    return new Promise(function(resolve, reject) {
        var userID = request.signedCookies.usercookie.userID;
        var u = new DBRow(lit.USER_TABLE);
        u.getRow(userID).then(function() {
            switch(request.body.type) {
                case ("class"):
                    return createClass(request.body.content, u, resolve, reject);
                case ("link"):
                    return createLink(request.body.content, u, resolve, reject);
                case ("question"):
                    return createQuestion(request.body.content, u, resolve, reject);
                default:
                    reject('Invalid request type');
            }
        }, function() {
            reject("User does not exist, should be logged out");
        })
    }).catch(function(err) {
        log.error(err);
        reject('Error during insertion of new content');
    });
};

/** Creates a new class row for the new class and inserts a new vote, contribution and item for it.
 *
 * @param body: The JSON object containing information about the item to be created
 * @param user: The current user's DBRow
 * @param resolve: The resolution of the linkHandler.handle function's promise
 * @param reject: The rejection of the linkHandler.handle function's promise
 */
function createClass(body, user, resolve, reject) {
    getTagsIfNotPresent(body);

    var c = new DBRow(lit.CLASS_TABLE);//TODO: Make this not hate you when you don't have prereqs or tags
    c.setValue(lit.FIELD_TITLE, body.title);
    c.setValue(lit.FIELD_COURSE_CODE, body.courseCode);
    c.setValue(lit.FIELD_INSTRUCTOR, body.instructor);
    c.setValue(lit.FIELD_CREDIT, body.credit);
    c.setValue(lit.FIELD_SUMMARY, body.summary);

    c.setValue(lit.FIELD_ADDED_BY, user.getValue(lit.FIELD_USERNAME));

    if (body.prereqs)
        c.setValue(lit.FIELD_PREREQS, body.prereqs);

    if (!body.tags)
        c.setValue(lit.FIELD_TAGS, 'DEFAULT');
    else
        c.setValue(lit.FIELD_TAGS, body.tags);

    c.insert().then(function() {
        vote(user, c, resolve); // if we make it this far we will always resolve
        contributor.generateContribution(c, user.getValue(lit.FIELD_ID), lit.CLASS_TABLE); // we can get away with creating the contribution in parallel in this case
        generateItem(c, user, lit.CLASS_TABLE); //ditto the item
    }, function(err) {
        log.error(err);
        reject("Error entering the new class");
    })
}

/** Creates a new link row for the new link and inserts a new vote, contribution and item for it.
 *
 * @param body: The JSON object containing information about the item to be created
 * @param user: The current user's DBRow
 * @param resolve: The resolution of the linkHandler.handle function's promise
 * @param reject: The rejection of the linkHandler.handle function's promise
 */
function createLink(body, user, resolve, reject) { // check if this link should be trusted
    getTagsIfNotPresent(body);

    var l = new DBRow(lit.LINK_TABLE);
    l.setValue(lit.FIELD_TITLE, body.title);
    l.setValue(lit.FIELD_SUMMARY, body.summary);
    l.setValue(lit.FIELD_LINK, body.href); // get this
    l.setValue(lit.FIELD_TAGS, body.tags);
    l.setValue(lit.FIELD_ADDED_BY, user.getValue(lit.FIELD_USERNAME));
    l.insert().then(function() {
        vote(user, l, resolve); // if we make it this far we will always resolve
        generateContribution(l, user, lit.LINK_TABLE); // we can get away with creating the contribution in parallel in this case
        contributor.generateItem(l, user.getValue(lit.FIELD_ID), lit.LINK_TABLE); // ditto the item
    }, function(err) {
        log.error(err);
        reject("Error entering the new link");
    })
}

/** Creates a new post row for the new question and inserts a new vote, contribution and item for it.
 *
 * @param body: The JSON object containing information about the item to be created
 * @param user: The current user's DBRow
 * @param resolve: The resolution of the linkHandler.handle function's promise
 * @param reject: The rejection of the linkHandler.handle function's promise
 */
function createQuestion(body, user, resolve, reject) { // also create a vote
    getTagsIfNotPresent(body);

    var q = new DBRow(lit.POST_TABLE);
    q.setValue(lit.FIELD_TITLE, body.title);
    q.setValue(lit.FIELD_CONTENT, body.summary);
    q.setValue(lit.FIELD_AUTHOR, user.getValue(lit.FIELD_USERNAME)); // get this
    q.setValue(lit.FIELD_TAGS, body.tags);

    q.insert().then(function() {
        vote(user, q, resolve); // if we make it this far we will always resolve
        contributor.generateContribution(q, user.getValue(lit.FIELD_ID), lit.POST_TABLE); // we can get away with creating the contribution in parallel in this case
        generateItem(q, user, lit.POST_TABLE); //ditto the item
    }, function(err) {
        log.error(err);
        reject("Error entering the new question");
    })
}

/** Creates tags for items that are being inserted with no tags
 *
 * @param body: The JSON object containing information about the item to be created
 * TODO: needs to be fully implemented
 */
function getTagsIfNotPresent(body) {
    if (!body.tags)
        body.tags = "DEFAULT";
}

/** Submits a vote for the new item. Resolves the promise of the newHandler.handle function to send the newly inserted
 * item's id to the client
 *
 * @param user: The current user's DBRow
 * @param item: The newly inserted item's DBRow
 * @param resolve: The resolution of the linkHandler.handle function's promise
 */
function vote(user, item, resolve) {
    voter.vote(user.getValue(lit.FIELD_ID), item.getValue(lit.FIELD_ID), 1).then(function() {
        resolve({'id': item.getValue(lit.FIELD_ID)});
    }, function(err) {
        log.error(err);
        resolve({'id': item.getValue(lit.FIELD_ID)});
    })
}

/** Generates the new item row that corresponds to the new item
 *
 * @param item: The newly inserted item's DBRow
 * @param user: The current user's DBRow
 * @param type: The type of the newly inserted item (either a class, post or comment)
 */
function generateItem(item, user, type) {
    var it = new DBRow(lit.ITEM_TABLE);
    it.setValue(lit.FIELD_TYPE, type);
    it.setValue(lit.FIELD_USER_ID, user.getValue(lit.FIELD_ID));
    it.setValue(lit.FIELD_ITEM_ID, item.getValue(lit.FIELD_ID));
    it.setValue(lit.FIELD_TAGS, item.getValue(lit.FIELD_TAGS));
    it.insert().then(function() {

    }, function(err) {
        log.error(err);
    })
}