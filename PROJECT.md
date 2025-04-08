# Project management of bolt.diy

First off: this sounds funny, we know. "Project management" comes from a world of enterprise stuff and this project is
far from being enterprisy- it's still anarchy all over the place 😉

But we need to organize ourselves somehow, right?

> tl;dr: We've got a project board with epics and features. We use PRs as change log and as materialized features. Find it [here](https://github.com/orgs/stackblitz-labs/projects/4).

Here's how we structure long-term vision, mid-term capabilities of the software and short term improvements.

## Strategic epics (long-term)

Strategic epics define areas in which the product evolves. Usually, these epics don’t overlap. They shall allow the core
team to define what they believe is most important and should be worked on with the highest priority.

You can find the [epics as issues](https://github.com/stackblitz-labs/bolt.diy/labels/epic) which are probably nevern going to be closed.

What's the benefit / purpose of epics?

1. Prioritization

E. g. we could say “managing files is currently more important that quality”. Then, we could think about which features would bring “managing files” forward. It may be different features, such as “upload local files”, “import from a repo” or also undo/redo/commit.

In a more-or-less regular meeting dedicated for that, the core team discusses which epics matter most, sketch features and then check who can work on them. After the meeting, they update the roadmap (at least for the next development turn) and this way communicate where the focus currently is.

2. Grouping of features

By linking features with epics, we can keep them together and document _why_ we invest work into a particular thing.

## Features (mid-term)

We all know probably a dozen of methodologies following which features are being described (User story, business
function, you name it).

However, we intentionally describe features in a more vague manner. Why? Everybody loves crisp, well-defined
acceptance-criteria, no? Well, every product owner loves it. because he knows what he’ll get once it’s done.

But: **here is no owner of this product**. Therefore, we grant _maximum flexibility to the developer contributing a feature_ – so that he can bring in his ideas and have most fun implementing it.

The feature therefore tries to describe _what_ should be improved but not in detail _how_.

## PRs as materialized features (short-term)

Once a developer starts working on a feature, a draft-PR _can_ be opened asap to share, describe and discuss, how the feature shall be implemented. But: this is not a must. It just helps to get early feedback and get other developers involved. Sometimes, the developer just wants to get started and then open a PR later.

In a loosely organized project, it may as well happen that multiple PRs are opened for the same feature. This is no real issue: Usually, peoply being passionate about a solution are willing to join forces and get it done together. And if a second developer was just faster getting the same feature realized: Be happy that it's been done, close the PR and look out for the next feature to implement 🤓

## PRs as change log

Once a PR is merged, a squashed commit contains the whole PR description which allows for a good change log.
All authors of commits in the PR are mentioned in the squashed commit message and become contributors 🙌
