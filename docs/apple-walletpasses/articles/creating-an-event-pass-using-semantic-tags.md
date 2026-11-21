Creating a poster event pass using semantic tags
Use semantic tags to provide up-to-date information for event passes.

### Overview
In iOS 26 and later and watchOS 26 and later you can provide an engaging event ticket experience by creating a poster event tickets using semantic tags in Wallet. This experience builds on the existing {PKPass} bundle in Wallet and maintains backward compatibility. For more information on semantic tags, see {supporting-semantic-tags-in-wallet-passes}.
Adding semantic tags to your event pass provides structured data that Wallet uses to automatically display information like event dates.
To create a poster event ticket using semantic tags, you need to meet the following minimum requirements:
  • Add `posterEventTicket` to the `preferredStyleSchemes`.
  • Provide the required semantic tags to populate the pass and certain event content.
> Poster event tickets aren’t compatible with tickets that require a QR code or barcode for entry.

### Set the preferred style scheme
The preferred style scheme is a top-level key that you provide. It takes an array of strings that correspond to schemes that the system resolves into a style type. Poster event tickets are considered event tickets, and the scheme is `posterEventTicket`.
Wallet recognizes this scheme and runs the the appropriate validation to designate the pass as a poster event ticket or fall back to the legacy event ticket.
The following is an example of the preferred style scheme structure:
```
 "preferredStyleSchemes": [
    "posterEventTicket",
    "eventTicket"
]
```

### Add the event ticket pass style
The pass’s style determines the overall visual appearance of the pass and the template for placement of information on the pass. The value of the pass style key is a dictionary containing fields that hold the pass content. Specify the pass style by providing the corresponding key at the top level of the `pass.json` file; event passes use the key `eventTicket`. For more information on building your pass json file, see {building-a-pass}.
The following example shows a partial event pass with top-level keys.
```
{
    "description": "A concert event pass.",
    "formatVersion": 1,
    "passTypeIdentifier": "pass.com.example.event-pass",
    "serialNumber": "123A4b5Z7p",
    "eventTicket": { ... }
}
```
The pass style controls how Wallet lays out the pass fields and which images it shows on someone’s device. The following images shows the layout and placement of fields for the event ticket style.
The pass style determines the maximum number of pass fields that can appear on the front of a pass. An event pass can display logo, strip, background, or thumbnail images. You can also include an extra row of up to four auxiliary fields. The text length in each pass field determines how many fields appear on the front of the pass. If the text is too long, Wallet won’t display all of it.

### Add the required semantic tags
Semantic tags are objects that contain machine-readable metadata the system uses to offer a pass and suggest related actions. For the poster event ticket style, the following list of semantic tags is required for the front of the pass and essential designs. If you omit any of these tags, your pass falls back to the legacy event pass style. For more information on semantic tags, see {SemanticTags}.
Required tags for all event passes | Description
`eventName` | The full name of the event, such as the title of a movie. Use this key for any type of event ticket.
`venueName` | The full name of the venue. Use this key for any type of event ticket.
`venueRegionName` | The name of the city or hosting region of the venue. Use this key for any type of event ticket.
`venueRoom` | The full name of the room where the ticketed event is to take place. Use this key for any type of event ticket.
Required tags for sport event passes | Description
`awayTeamAbbreviation` | The unique abbreviation of the away team’s name. Use this key only for a sports event ticket.
`homeTeamAbbreviation` | The unique abbreviation of the home team’s name. Use this key only for a sports event ticket.
Required tags for live performance event passes | Description
`performerNames` | An array of the full names of the performers and opening acts at the event, in decreasing order of significance. Use this key for any type of event ticket.
The following examples show a `pass.json` file with the required semantic tags for a general, sport, and live performance event pass:

### Include recommended and optional semantic tags
Using recommended and optional semantic tags can enhance someone’s event pass experience in Wallet. The event guide provides access to information like the venue map and weather forecast, and to quick actions like checking a baggage policy and ordering food. You can display a minimum of one and up to four quick action buttons.

For design guidance, see Human Interface Guidelines > Wallet > Passes > {wallet#Event-tickets}.
The following list of semantic tags are optional, but recommended for optimal pass design:
Recommended tags for all event passes | Description
`eventStartDate` | The date and time the event starts. Use this key for any type of event ticket.
`eventStartDateInfo` | An object that provides information for the date and time the event starts. Use this key for any type of event ticket.
The following semantic tags are optional:
Base (Inherited by all event passes) | Description
`eventEndDate` | The date and time the event ends. Use this key for any type of event ticket.
`venueLocation` | An object that represents the geographic coordinates of the venue. Use this key for any type of event ticket.
General event tag | Description
`admissionLevel` | The level of admission the ticket provides, such as `general admission`, `VIP`, and others. Use this key for any type of event ticket.
`attendeeName` | The name of the person the ticket grants admission to. Use this key for any type of event ticket.
Sport event semantic tags | Description
`awayTeamName` | The home location of the away team. Use this key only for a sports event ticket.
`homeTeamLocation` | The home location of the home team. Use this key only for a sports event ticket.
`homeTeamName` | The name of the home team. Use this key only for a sports event ticket.
`leagueAbbreviation` | The abbreviated league name for a sports event. Use this key only for a sports event ticket.
`leagueName` | The unabbreviated league name for a sports event. Use this key only for a sports event ticket.
`sportName` | The commonly used name of the sport. Use this key only for a sports event ticket.
Live performance event semantic tag | Description
`artistIDs` | An array of the Apple Music persistent ID for each artist performing at the event, in decreasing order of significance. Use this key for any type of event ticket.

### Populate multiday events
Use {RelevantDates-data.dictionary} to provide a list of date ranges for events that are more than one day like multiday festivals or season tickets. The following code shows an example `relevantDates` object for a multi day event.
```
"relevantDates": [
    {
        "startDate": "2025-08-21T13:00-08:00",
        "endDate": "2025-08-21T23:00-08:00"
    }, {
        "startDate": "2025-08-22T13:00-08:00",
        "endDate": "2025-08-22T23:00-08:00"
    }
]
```

### Ensure backward compatibility
To ensure your pass is backward compatible, continue to provide the {PrimaryFields-data.dictionary}, {SecondaryFields-data.dictionary}, and {AuxiliaryFields-data.dictionary} so the system presents the legacy event pass style, if necessary. Poster event tickets add keys and assets to the existing `PKPass` bundle that legacy event passes use. By building on the legacy pass bundle, Wallet automatically generates the appropriate device experience for iOS and watchOS.
 | 
Pass fields for a legacy event pass. | Pass fields for a poster event pass.
When someone adds a pass to a device, that pass automatically syncs to all devices linked to the same Apple Account. When a supported device with iOS 26 or later or watchOS 26 or later syncs to a device that doesn’t support semantic tags, Wallet recognizes the pass as a legacy event ticket pass. Possible scenarios include:
  • The legacy fields aren’t present: there is no content on the pass.
  • The legacy fields are present but invalid: ingestion fails on all devices.
  • The legacy fields are present and valid: Wallet displays a fully populated legacy event ticket pass.
If someone adds a multiday event pass to an unsupported device and syncs it to a supported device with iOS 26 or later or watchOS 26 or later, Wallet displays the poster event ticket pass information after you meet the minimum requirements by setting the top-level style dictionary and adding the required semantic tags. If you don’t meet the requirements, Wallet displays a legacy event ticket pass.

### Provide scannable codes
Passes can work with Near Field Communication (NFC) readers and barcodes. Someone can hold a device near an NFC reader with the contactless symbol to use their pass. When employing NFC, the pass doesn’t need a barcode.
Alternatively, passes can use scannable barcodes to convey information. Wallet supports QR, PDF417, Aztec, Code128, Code 39, Codabar, EAN-13, and Interleaved 2 of 5 (ITF) barcode formats. Wallet optimizes the presentation of passes in order to facilitate a successful scan.
For more information on barcodes, see {Barcodes-data.dictionary} and the {}.
For design guidance about event passes, see Human Interface Guidelines > Wallet > Passes > {wallet#Event-tickets}.

### Debug the pass
If the pass doesn’t display and add to Wallet, check the logs for a description of what went wrong. If you’re using Simulator to debug, you can drag your `.pkpass` file into the Simulator, then use the Console app on your Mac to view the Simulator device logs.
When testing on a device, errors are logged to the device’s console, which you can view from the Xcode organizer window. You can filter the logs by using your pass type ID or serial number to limit the device log output to a specific pass instance. See {acquiring-crash-reports-and-diagnostic-logs} for information on accessing a device’s console log, as well as downloading and installing the Wallet profile.
Common errors include malformed JSON files, misspelled keys or values, pass type identifiers that don’t match your certificate, and signatures that omit the Apple Worldwide Developer Relations Intermediate Certificate. For more information on common issues with pass creation, see {building-a-pass#Common-Problems}.
For design guidance see, HIG > Wallet > Passes > {wallet#Event-tickets}.