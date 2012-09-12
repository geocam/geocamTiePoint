// __BEGIN_LICENSE__
// Copyright (C) 2008-2010 United States Government as represented by
// the Administrator of the National Aeronautics and Space Administration.
// All Rights Reserved.
// __END_LICENSE__

var POLL_TIMEOUT_MS = 5000;

var exportCompleteTimerG = null;

function clearErrors() {
    $('#exportError').html('');
}

function renderExportingStatus() {
    ($('#exportMain').html
     ('<table>' +
      '<tr><td style="vertical-align: middle">' +
      '<img' +
      ' src="' + STATIC_URL + 'geocamTiePoint/images/loading.gif"' +
      ' width="32"' +
      ' height="32"' +
      '/>' +
      '</td>' +
      '<td style="vertical-align: middle">' +
      'Exporting aligned overlay (may take a few minutes)' +
      '</span>' +
      '</td></tr>' +
      '</table>'));
    // TODO put in loading gif
}

function sendExportRequest() {
    var generateZipUrl = (overlay.url.replace
                          ('.json', '/generateZip'));
    ($.post(generateZipUrl,
            '', /* empty post data */
            function() {}, /* no-op on success */ 
            'json')
     .error(function (xhr, status, error) {
         $('#exportError').html('Error during export: ' + error);
         renderExportButton();
         cancelPollForExportComplete();
     }));
}

function checkForExportComplete() {
    $.getJSON(overlay.url, function (response) {
        overlay = response;
        if (overlay.exportZipUrl) {
            renderDownloadLink();
        }
    });
}

function pollForExportComplete0() {
    checkForExportComplete();
    exportCompleteTimerG = setTimeout(pollForExportComplete0, POLL_TIMEOUT_MS);
}

function pollForExportComplete() {
    exportCompleteTimerG = setTimeout(pollForExportComplete0, POLL_TIMEOUT_MS);
}

function cancelPollForExportComplete() {
    if (exportCompleteTimerG != null) {
        clearTimeout(exportCompleteTimerG);
        exportCompleteTimerG = null;
    }
}

function handleExportClick() {
    clearErrors();
    renderExportingStatus();
    sendExportRequest();
    pollForExportComplete();
}

function renderExportButton() {
    ($('#exportMain').html
     ('<button id="generateZip" type="button">' +
      'Export Aligned Overlay</button> (may take a few minutes)'));

    $('#generateZip').click(handleExportClick);
}

function renderDownloadLink() {
    ($('#exportMain').html
     ('<a href="' +
      overlay.exportZipUrl +
      '">Download aligned overlay in zip file format</a>'));
}

function initialize() {
    if (overlay.exportZipUrl) {
        renderDownloadLink();
    } else {
        renderExportButton();
    }
}
