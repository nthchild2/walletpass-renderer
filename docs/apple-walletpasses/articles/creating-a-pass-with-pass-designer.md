Creating a pass with Pass Designer
Construct and customize a variety of pass styles with this easy-to-use tool.

### Overview
With Pass Designer, you can easily visualize and design effective passes for Apple Wallet using a simple macOS app.  Start with one of the templates provided for inspiration or use your own template to design passes that reflect your business or brand personality.

Using the Pass Designer app, you can both design and preview passes in real time, seeing exactly how your passes appear to people. The Wallet app makes it easy for people to access their passes right when they need them, and Pass Designer makes it easy to create passes that look great and reflect the personality of an issuer’s brand. For example, a music venue can customize passes to display album cover art for the artist who’s performing.
To use the Pass Designer app on Mac:
  • {?q=pass%20designer} the app.
  • Make sure you have macOS 27.0 or later installed.

### Choose a pass type
There are six primary types of passes you can create using the Pass Designer app, detailed below. You can easily visualize the appearance of each pass in each version of the software, so you can design a pass that looks great no matter what system a person is viewing it in. You can even create a blank pass or create one completely from scratch.
When you first open the app and create a new document, Pass Designer presents you with the Template Picker, which you  use to select the style of pass you want to build. Pick a specific template, and the app preloads your pass with all the relevant text fields and image placements, which you can then customize for your design.


### Set up your workspace
The left-hand sidebar contains all the components for a specific pass. Click on a component to open an editor panel from which you can customize each section of your pass. The right-hand side of the app shows you previews of your pass designs.

To select the background color for your canvas, use the canvas background setting. Depending on the colors you’re using, this feature can make it easier to see the design. For example, if you’re working on a pass with a white background, setting the background color of the app to black can make seeing your pass design easier.


### Customize your pass components
Each pass is composed of a number of components, each of which is responsible for helping define a different aspect of your pass design. The components section of the Pass Designer tool is where you can customize all of your components to tailor your pass to your target audience.


### Configure the identity and signing
In the Identity & Signing section, you can add information about your business or company. This metadata becomes available to people in the pass information.
If you’ve already created a Pass Type ID certificate, you can easily import all the information directly from the certificate. For more information on creating a Pass Type ID certificate, see {}.


### Select the pass style
In the Style section, you can select the type of pass you want to create. For boarding passes, you can also select other categories like Transit Type, where you can choose between Air, Train, Boat, Bus, or Generic as the travel mode.
> Only the air travel boarding pass supports the new Semantic Pass designs available in iOS 26 and later.

You can also select the colors used throughout your pass design. Ensure the colors you pick for labels are accessible and easy for people to read, especially when using background images in your pass. For design guidance on optimizing color choices, see the {wallet#Designing-passes} section of the Human Interface Guidelines.

The graphic below shows which section of the pass each color field refers to:


### Add images to your pass
Each style of Wallet pass has different types of images you can use to help create a dynamic pass, ranging from small iconography to large background images.

Provide each image to Pass Designer in PNG format at its 2x and 3x sizes to ensure that it renders properly no matter what device someone is viewing it on. The Pass Designer tool tells you which images are needed for each pass.
To learn more about which images are available for each pass type and how to construct them, see the following table:
Pass type | Boarding pass | Coupon | Event ticket | Store card | Generic pass | Poster generic pass
`Icon` | All | All | All | All | All | All
`Logo` | < iOS 26 and earlier and non-airline | < iOS 26 | < iOS 18 | < iOS 26 | < iOS 26 | iOS 27+
`Primary logo` | iOS 27+ | iOS 27+ | iOS 18+ | NA | NA | iOS 27+
`Secondary logo` | NA | NA | iOS 18+ | NA | NA | NA
`Strip image` | NA | < iOS 26 | NA | <iOS 26 | NA | NA
`Thumbnail image` | NA | NA | < iOS 26 | NA | < iOS 26 | NA
`Background` | NA | NA | iOS 18+ | NA | NA | NA
`Background artwork` | NA | NA | iOS 27+ | NA | NA | iOS 27+
`Footer image` | NA | NA | NA | NA | NA | NA

### Add an icon
An icon needs to be a square 38-by-38-pixel image, appears on every type of pass style, and typically represents your brand or app.

Your icon also appears in Lock Screen banners, in Mail, and on passes in the Wallet app. If your pass has an associated app, your icon can represent your app icon. When someone taps on an icon in the Wallet app, it either opens your app or the App Store page for your app. To see a preview, build your pass and view it in the Wallet app on iPhone.

### Add a logo
The logo appears in the top left of your pass design and can be anything from a symbol representing your brand to text representing your brand identity.

The logo appears on the following pass styles: boarding passes (before iOS 26), generic passes (all versions), coupons (all versions), event passes (before iOS 18), and store cards (all versions).

The logo needs to be 50 pixels tall and can be anywhere from 50 to 160 pixels wide at the maximum. For design guidance on creating your logo see {wallet#Pass-styles} in the Human Interface Guidelines.

### Add a primary logo
The primary logo appears in the top left of your pass design and can be anything from a symbol representing your brand to text representing your brand identity.

The primary logo needs to be 30 pixels tall and can be any width from 30 to 126 pixels.
The primary logo appears on the following pass styles: boarding passes (iOS 26 and later) and event passes (iOS 18 and later). Even though you may design your pass for the latest OS, remember that not every person views the pass on the same software. Be sure to include a logo as well for instances when the pass displays on previous software versions.

### Add a secondary logo
The secondary logo is a mark that appears in the bottom right of an event pass beginning in iOS 18.

You can use the secondary logo to represent information like the event venue, the brand logo of a ticket seller that the person purchased their ticket through, or other branding related to the event itself.

The secondary logo can range from a square 12-by-12-pixel icon up to a rectangular 12-by-135-pixel icon. Choose what shape and size suits your logo best.

### Add a strip image
Strip images appear as a narrow band on coupons and store cards, providing space where you can include imagery to help tie in your brand or offer.

The strip image needs to be 375 by 144 pixels. Be mindful that you can place text over strip images in your pass design, so ensure there’s good readability and contrast between your text and the strip image.

The primary field and strip image are in the same place on the pass. If you add any text in a primary field, it automatically appears over the strip image. For design guidance on creating the most effective strip image, refer to the Human Interface Guidelines section on {wallet#Coupons}.

### Add a thumbnail image
Thumbnails are small images that appear on generic passes and nonposter event tickets.

They can be used for anything from helping to identify the type of event in an event pass to showing an image that helps the user identify the pass in a generic pass design. The thumbnail needs to be 90 pixels tall and can be anywhere between 60 and 90 pixels wide.


### Add a background image and background artwork
Background images offer an effective way to make your pass design feel unique and immersive. Backgrounds appear blurred with nonposter event tickets and unblurred on poster event tickets and poster generic passes.
If your background has important elements, be mindful that they don’t get covered up by any of the safe areas of the pass overlays. For more guidance on designing background images, see the Human Interface Guidelines page on {wallet#Event-tickets}.

### Add a footer image
The footer image is available for airline boarding passes starting in iOS 26 and later. This thin image appears at the bottom of a pass, and you can use it for ancillary information.

### Configure the barcodes and NFC
Barcodes are an essential part of designing a useful Wallet pass, from letting people easily scan their boarding pass at an airport to using a coupon code at checkout. With Pass Designer, you can fully customize the type of barcode included on your pass as well as how it’s displayed.
You can provide all barcode information directly in the Pass Designer app, and the barcodes generate automatically, with no need to provide any barcodes as images.

The types of barcodes available are QR, PDF417, Aztec, Code128, Code 39, Codabar, EAN-13, and Interleaved 2 of 5 (ITF). When designing your pass, take into consideration how the barcode placement affects elements like background images. If you’re including a background image, ensure the barcode doesn’t cover important visual areas of your image. Don’t include any barcodes in images. For design guidance on pass layout, see the Human Interface Guidelines page on {wallet#Designing-passes}.

### Add semantic tags
Semantic tags are information fields that you provide and that Pass Designer automatically lays out on your pass design. Simply provide the information and the app prioritizes where to put each piece of information. Semantic tags are available for Boarding Passes (in iOS 27 and later) and Event Passes (in iOS 18 and later).

The type of information you provide as semantic tags differs depending on the pass styles. For example, a boarding pass may have semantic tags for things like flight details, airports, and seating, whereas an event pass for a sporting event might include semantic tags for team information, match details, and seating location.
Semantic tags can also display additional pass actions that the system displays when someone views the pass in the Wallet app on iPhone. These quick actions make it easy for someone viewing your pass to find related information, such as the bag policy for an event or hotel booking information, when looking at their membership card.
For more guidance on using semantic tags, see {defining-the-metadata-of-your-wallet-pass#Add-semantic-tags}.

### Text fields
Text fields allow you to enter information in the fields of your pass. Text fields have fixed sections where field types appear. For more information on the layout of pass fields, see {defining-the-metadata-of-your-wallet-pass}.
When designing a semantic pass, be sure to also provide text fields to ensure backward compatibility. Pass Designer automatically populates the relevant text fields when you select a specific type of pass template. If you include more fields than the pass can display, the additional fields don’t appear on the pass face, but are still  included in the pass information when viewed in the Wallet app.

Semantic boarding passes and event passes are backward-compatible and fall back to using text fields. For more information, see {creating-an-airline-boarding-pass-using-semantic-tags#Ensure-backward-compatibility} and {defining-the-metadata-of-your-wallet-pass#Provide-content-for-your-pass-fields}.

### Upload your pass bundle to Pass Builder
After you finish designing your pass, save the pass. Pass Designer creates a `.pkpasstemplate` bundle that you use to build, sign, and distribute your pass.
Pass Builder is a Swift on Server package with which you can programmatically create and distribute passes for Apple Wallet. The server package provides a type-safe API for building and signing Wallet Passes. Download the  Pass Builder package and documentation on {pass-builder}.
If your distribution model isn’t suitable for Pass Builder, you can decompress the contents of the `.pkpasstemplate` bundle and sign and build them using the method described in {building-a-pass}.