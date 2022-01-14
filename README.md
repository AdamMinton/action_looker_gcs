# Google Cloud Storage

## Write data files to Google Cloud Storage bucket.

The Google Cloud Storage action enables you to send and store a data file on Google Cloud Storage via the Google Cloud API.

The action requires a Google Cloud Storage account, a programmatic service account and authorized key file to authenticate the Google Cloud API.

1. Enable the Google Cloud Storage API in the Google Cloud [console](https://console.cloud.google.com/apis/dashboard).

2. Create a Service Account in the Google Cloud [console](https://console.cloud.google.com/iam-admin/serviceaccounts/project).

![](<Create GCS Service Account Key File.png>)

3. Create a Service Account Key and download the JSON key file in the [console](https://console.cloud.google.com/apis/credentials). Note the Project Id, Client Email, Private Key to add in the Looker admin page to authenticate with the GCS API.

![](<Create GCS Service Account.png>)

4. Fork or Clone this repo.

5. Add the repo to [Google Cloud Repository](https://cloud.google.com/source-repositories/docs/mirroring-a-github-repository).

6. Create a Looker Secret in [Secret Manager](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets). This can be any long string that will allow the execute and form functions to run when authenticated.

7. Create a new [Google Cloud Function](http://www.console.cloud.google.com/functions/list). Set function name to looker-action-gcs. Set Authentication to Allow unauthenticated invocations. Copy the URL. Click Save.

![](<Create GCF - Step 1.png>)

8. Open Runtime, build, connections and securit settings. In RUNTIME, add variable named CALLBACK_URL_PREFIX. The value will be set to the URL of the GCF function (from previous step).

![](<Create GCF - Step 2.png>)

9. In SECURITY, click Reference a Secret. Select the secret created in the previous step and expose as environment variable. Name the secret LOOKER_SECRET with value set to latest. Click Done and Next.

![](<Create GCF - Step 3.png>)

10. Set Runtime to Node.js 14. Set Entry point to httpHandler. Set Source code to Cloud Source repository. Set Repository name to what it was named in previous step. Set Branch name to main. Click Deploy.

![](<Create GCF - Step 4.png>)

11. In Looker - Admin - Actions, click Add Action Hub. Set Action Hub URL to GCF you created. Click Add Action Hub. Click Configure Authorization and set value to secret set in previous step. Click Update Token.

12. Enable the action by specifing the credentials from your previously created service account. After credentials are saved, your action should test successfully.
