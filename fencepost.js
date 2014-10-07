var validExpires = [
  "day",
  "week",
  "month",
  "never"
];

var messageFor = function (errorCode) {
  return {
    "post-not-logged-in": "Must be logged in to post."
  }[errorCode];
};

Posts = new Mongo.Collection("posts");

var expiresStringToDate = function (expiresString) {
  if (expiresString === "never") {
    return Infinity;
  } else {
    return moment().add(1, expiresString).valueOf();
  }
};

var validExpiration =  Match.Where(function (str) {
  return _.contains(validExpires, str);
});

Meteor.methods({
  post: function (postData) {
    check(postData, {
      title: String,
      content: Match.Optional(String),
      expires: Match.Optional(validExpiration),
      location: {
        lat: Number,
        lng: Number
      }
    });

    if (! this.userId) {
      throw new Meteor.Error("post-not-logged-in");
    }

    // handle absent option
    postData.expires = postData.expires || "never";

    // add user data
    postData.userId = this.userId;
    postData.postedBy = Meteor.users.findOne(this.userId).profile.name;

    // convert expiration string to date
    postData.expiresAt = expiresStringToDate(postData.expires);

    // insert into DB
    Posts.insert(postData);
  }
});

if (Meteor.isClient) {
  Template.body.helpers({
    loc: function () {
      // return 0, 0 if the location isn't ready
      return Geolocation.latLng() || { lat: 0, lng: 0 };
    },
    error: Geolocation.error,
    posts: function () {
      return Posts.find();
    }
  });

  var newPostErrors = new Meteor.Collection(null);
  var posting = new ReactiveVar();
  Template.newPost.helpers({
    errors: function () {
      return newPostErrors.find();
    },
    posting: function () {
      return posting.get();
    },
    errorFor: function (name) {
      var error = newPostErrors.findOne({name: name});
      return error && error.message;
    },
    name: function () {
      return Meteor.user().profile.name;
    }
  });

  Template.newPost.events({
    "keydown input": function (event) {
      newPostErrors.remove({name: event.target.name});
    },
    "submit form": function (event) {
      event.preventDefault();

      var title = event.target.title.value;
      var content = event.target.content.value;
      var expires = event.target.expires.value;
      var location = Geolocation.latLng();

      var clearForm = function () {
        event.target.title.value = "";
        event.target.content.value = "";
      };

      newPostErrors.remove({});

      if (! title.length) {
        newPostErrors.insert({
          name: "title",
          message: "Title can't be empty."
        });
      }

      if (! location) {
        newPostErrors.insert({
          name: "location",
          message: "Can't post without a location."
        });
      }

      if (newPostErrors.find().count()) {
        return;
      }

      // client side validation passed
      Meteor.call("post", {
        title: title,
        content: content,
        expires: expires,
        location: location
      }, function (error) {
        posting.set(false);

        if (error) {
          newPostErrors.insert({
            name: "general",
            message: messageFor(error.error)
          });
        } else {
          clearForm();
        }
      });

      posting.set("true");

      return false;
    }
  });
}