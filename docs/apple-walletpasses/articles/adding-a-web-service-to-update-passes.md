Adding a Web Service to Update Passes
Implement a web server to register, update, and unregister a pass on a device.

### Overview
Keep your users’ pass updated with the latest information, such as the time of a flight or the location of the next geocached object in a game.

Create an updatable pass by adding the `webServiceURL` and `authenticationToken` keys to {Pass}. The system calls your server endpoints using the base URL you provide. Updating a pass is a cooperative effort between the user’s device, Apple servers, and your server. The high-level steps are:
  • The user installs a pass that supports updates on their device.
  • The user’s device registers the pass with your server and provides a device identifier and a push token.
  • Pass information changes and your server sends a push notification.
  • The user’s device receives the notification and queries your server for updated passes.
  • The user’s device requests each pass that has changed.

### Server Configuration
Authenticate each call to your server using a shared secret before responding using one of two shared secrets. Use the value of `authenticationToken` for the pass to authenticate the calls that register and unregister a pass, and to send an updated pass. The other shared secret is the device library ID, a value that’s sent by the device when the device registers a pass. Use this secret to authenticate the call for the serial numbers of updated passes.
>  Your web service must use an HTTPS connection for production, but you can use an HTTP connection during testing.

### Store Information
Updating passes requires storing information for the registered passes and for their associated devices. One way you can store these details is to use a traditional relational database with two entities – devices and passes – and one relationship, registrations. The three tables are:

### Register and Unregister a Pass
Add the relationship when a device registers an updatable pass.

Complete these tasks to register a pass:
  • Create a new entry for the pass if one doesn’t exist.
  • Create a new entry for the device if one doesn’t exist.
  • Store the mapping between the pass and the device library identifier in the registrations table.
Remove the relationship when a device unregisters an updateable pass.

Complete these tasks to unregister a pass:
  • Delete the mapping between the pass and the device library identifier from the registrations table.
  • Delete the device entry from the device table if the registration table has no more entries for that device.

### Update a Pass
You can update any type of pass and any information in the pass, except for the authentication token and the serial number. An updated pass is a new pass with the same pass type identifier and serial number. For more information on creating a pass, see {creating-the-source-for-a-pass} and {building-a-pass}.
Updating the pass involves several steps for both your server and the client device that contains the pass:
  • Your server sends a push notification to the device.
  • The device requests the serial numbers for updated passes.
  • Your server sends the serial numbers for the updated passes.
  • The device requests a specific pass.
  • Your server sends the updated pass.

### Send a Push Notification

Send a push notification to a registered device to indicate that there’s an updated pass. Do this using the following steps:
  • Find the registered devices for the updated pass.
  • Create and send a push notification for each registered device. The notification uses the same certificate and private key that the creator of the pass used to sign the original, the push token registered by the device, and an empty JSON dictionary for the payload.
Delete a device if the Apple Push Notification service (APNs) returns an error that the push token is invalid.
For more information on sending push notifications, see {sending-notification-requests-to-apns}.
>  A push notification for a pass update works only in the production environment.

### Return the Updated Passes
A device that receives the push notification requests a list of serial numbers for updated passes, such as a tickets to an event. Your server sends the serial numbers for updated passes.

Keep track of the update time of a pass to limit the number of serial numbers your server sends when a device requests the updated passes. Set the `lastUpdated` key of {SerialNumbers} to the last update time. The device saves the value and uses it to set the `previousLastUpdated` command line argument of {Get-the-List-of-Updatable-Passes}.
To send the list of serial numbers:
  • Find the list of passes registered for the device using the registrations table.
  • Select the passes that have been updated since your web service provided the `updated` tag, or all passes when there’s no tag. If there are multiple updates to a pass, select the one with the most recent update.
  • Create the {SerialNumbers} JSON response dictionary and send it with the response. For example:
```
{
    "serialNumbers" : ["001", "020", "3019"],
    "lastUpdated" : "1351981923"
}
```
The device then sends a request to your server for each updated pass.