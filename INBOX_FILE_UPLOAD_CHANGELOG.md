# Inbox file upload change

Updated the buyer/seller messaging system to support file attachments.

- Both buyer and seller inbox composers can attach files.
- Up to 5 files can be attached to one message.
- Any file extension/MIME type is accepted by the inbox uploader.
- Maximum attachment size is 100 MB per file.
- Attachments can be sent without message text.
- Attachments are displayed in the conversation with filename and size.
- The public "Contact seller" message dialog also supports attachments.
- Firebase Storage rules allow authenticated users to upload message attachments under their own user path.

The source archive intentionally excludes `.env.local` and `.git` so secrets and repository metadata are not redistributed.
