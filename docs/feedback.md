# Feedback collection

The shared header opens a Tally form in a dialog. Keep the form to one required long-answer field so visitors can submit free-form feedback without giving their name or email address. The dialog also passes the current workspace (`tournament`, `player`, or `league`) as optional context; it does not attach Rankedin references.

## Connect the form

1. [Create a Tally form](https://tally.so/create) with a title such as **Send feedback** and one required **Long answer** question. Do not ask for a name, email address, or other identifying information. Add a hidden field named exactly `workspace` to capture the context passed by the dialog. See the [Tally form guide](https://tally.so/help/create-a-form) and [hidden-fields guide](https://tally.so/help/hidden-fields).
2. Publish the form and copy its public link. The form ID is the final segment in a link such as `https://tally.so/r/FORM_ID`.
3. In [Make](https://www.make.com/en/register), create a scenario with the Tally **Watch New Responses** trigger. Connect your Tally account, authorize access, and select the feedback form. The trigger is instant.
4. Add the GitHub **Create an Issue** action. Connect the GitHub account that should appear as the issue author, then select owner `winrarr` and repository `rankedin-explorer`.
5. Map the issue title to `Website feedback` (or a similar fixed title). Map the issue body to the long-answer response and the hidden `workspace` value. Do not include respondent identity fields. A `feedback` label is optional; create that repository label first if you want to use it.
6. Test with a recognizable sample submission. This creates a real public issue, so close it after confirming the mapping. Turn the scenario on; Make's instant trigger runs when a new response arrives. See [Tally's Make integration guide](https://tally.so/help/make-integration) and [Make's GitHub app guide](https://apps.make.com/github).
7. Add a repository variable named `TALLY_FEEDBACK_FORM_ID` with the form ID (not the full URL) at [GitHub Actions variables](https://github.com/winrarr/rankedin-explorer/settings/variables/actions/new). Then run the **Deploy to GitHub Pages** workflow from [GitHub Actions](https://github.com/winrarr/rankedin-explorer/actions/workflows/deploy.yml) so the published site receives the form ID. For local builds, set `VITE_TALLY_FEEDBACK_FORM_ID` in `.env.local`.

The form ID is public configuration, not a secret. Do not include private player or tournament references in the issue body. Tally, Make, and GitHub process the submitted text, and GitHub issues are public. Free Tally embeds include Tally branding.
