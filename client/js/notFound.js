/**
 * notFound.js
 * Written by Michael Albinson 3/20/17
 */

"use strict";

/**
 * Adds the text containing the URL of the page to the document
 */
function addUrl() {
    $('#urlText').html('The URL: <b><a class="body-link" href="' + window.location.href + '">' + window.location.href + '</a></b> could not be found.');}