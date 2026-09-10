Go ahead and take in this context as needed:

/Users/harry/Documents/git/recipes/AGENTS.md
/Users/harry/Documents/git/recipes/docs/DESIGN.md
/Users/harry/Documents/git/recipes/docs/mvp/ui-implementation-guide.md

Then, please see /Users/harry/Documents/git/recipes/docs/mvp/backlog.md and identify a feature that you would like to implement that hasn't been implemented yet.

For your feature, please:

1. Create a plan to implement the test/feature in the spirit of what you understand the vision for the feature to be. If you can't create such a plan, or the feature you picked to work on is blocked by another test/feature that hasn't been built yet, find another feature to work on instead. If your work is blocked by something that isn't enumerated in /Users/harry/Documents/git/recipes/docs/mvp/backlog.md, please implement that thing then make a note the changes you made in the backlog file in the sequence where it belongs. Or, if you encounter a runtime or authentication or some other issue that is blocking you from implementing or testing your feature, please disregard the feature you picked and work on this issue you discovered instead. 
2. Implement your plan and then validate that it works as you expected by running the app and logging in with the test account credentials you can find at .env (if auth has been implmented and the agent that implemented it left credentials in that file)
3. Update AGENTS.md or other instructions files as needed if your changes warrant it.
4. Add testing coverage to test your feature if possible.
5. Run `npm run prettify` to format your changes
6. Confirm `npm run ci` passes

- if npm run ci or prettify don't exist yet, please create them. I intend for npm run ci to run my full linting and test suite to do the local confirmation that a branch is ready to merge. Eventually, I will set up github actions CI/CD pipeline which will run the same steps as npm run ci. For now, github actions is overkill until we build the application and receive contribution, and the npm script for running the CI steps and validating a branch is sufficient. 
- Fix any issues and repeat steps 5 and 6 until you've fixed all issues introduced by your implementation in this session. The expectation is that `npm run ci` should pass without warnings or errors.


8. Mark the feature that you created as implemented
9. Update any repository documentation as needed in response to the changes that you made in this session. 
10. This session is complete! ^_^
