Distributing and updating a pass
Distribute a pass to your users or update an existing pass.

### Overview
There are four ways you can distribute a pass:
  • Automatically add a pass during an in-app action.
  • Add a pass from an app or App Clip.
  • Provide a download on a web page for one pass or a bundle containing multiple passes.
  • Send a pass as an attachment in an email.
You can add a pass automatically during an in-app action. When someone completes an action in your app that produces a pass, such as checking into a flight, you can add the pass to Wallet automatically without an additional confirmation prompt. Request the `backgroundAddPasses` capability once with {requestAuthorization(for:completion:)}. This request shows a one-time permission prompt; if you call it after the person has responded, it doesn’t prompt again, but instead returns the current status. People can manage this permission from Settings.
After the initial request, check {requestAuthorization(for:completion:)} to silently determine whether someone authorized your app to add passes in the background, without showing a prompt. If the status is `authorized`, call {addPasses(_:withCompletionHandler:)} with an array of one or more passes to add them to Wallet in a single call. Wallet adds the passes in the background and notifies the person with a system notification instead of an on-device confirmation.
If you don’t request `backgroundAddPasses`, the `addPasses` method shows a prompt on the device before adding each pass to Wallet.
>  Automatically adding passes during an in-app action requires your app to be installed and running on the device.
In your app or App Clip, add a {PKAddPassButton} to show that a pass is available. When the user taps the button, show a {PKAddPassesViewController} for the pass.
On your website, show an Add to Apple Wallet button. Download the pass when the user clicks the button. For more information on displaying the button, see the {add-to-apple-wallet-guidelines}
Update a pass by distributing a new version of the pass with the same pass identifier and serial number. For more information on the pass identifier and serial number, see the `passTypeIdentifier` and `serialNumber` keys of the {Pass} object.
You can optionally provide a web service to update the contents of a user’s pass, such as changing the time for an event. For more information about implementing a pass update web service, see {adding-a-web-service-to-update-passes}.

### Create a bundle of passes
Provide a bundle of passes to enable your user to download multiple passes at once. To create the pass bundle:
  • Create a `.zip` file containing the `.pkpass` files for the passes that are part of the bundle.
  • Change the extension of the `.zip` file to `.pkpasses`.
You can distribute a bundle of passes the same way you distribute a single pass. The MIME type for a bundle of passes is “`application/vnd.apple.pkpasses"`.
>  You can have up to 10 passes or 150 MB for a bundle of passes.