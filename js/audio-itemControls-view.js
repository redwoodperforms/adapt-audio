define([
    'core/js/adapt'
], function (Adapt) {

    var AudioItemControlsView = Backbone.View.extend({

        className: "audio-controls",

        initialize: function () {
            this.listenTo(Adapt, {
                "remove": this.remove,
                "device:changed": this.setAudioFile,
                "audio:updateAudioStatus device:resize": this.updateToggle,
                "audio:updateAudioAutoplayGlobal": this.updateAutoplay
            });

            this.listenToOnce(Adapt, "remove", this.removeInViewListeners);

            // Set vars
            if (this.model.get('_audio')) {
                this.audioChannel = this.model.get('_audio')._channel;
            }
            this.elementId = this.model.get("_id");
            this.elementType = this.model.get("_type");
            this.audioIcon = Adapt.audio.iconPlay;
            this.pausedTime = 0;
            this.onscreenTriggered = false;

            this.render();
        },

        removeInViewListeners: function () {
            this.$el.off('onscreen');
        },

        events: {
            'click .audio-toggle': 'toggleAudio'
        },

        render: function () {
            this.setupAudio();
            var data = this.model.toJSON();
            var template = Handlebars.templates["audioControls"];
            this.$el.html(template(data));
            // Add audio icon
            this.$('.audio-toggle').addClass(this.audioIcon);
            var itemElem = this.model.get("itemElement");
            if (this.model.get('_audio')._location == "bottom-left" || this.model.get("_audio")._location == "bottom-right") {
                itemElem.find(".item-audio-container").append(this.$el);
            } else {
                itemElem.find(".item-audio-container").prepend(this.$el);
                // $(this.el).html(template(data)).prependTo('.' + this.model.get('parentId') + ">.item-" + this.model.get("itemIndex") + "-audio>.item-audio-container");
            }
            // Add class so it can be referenced in the theme if needed
            $(this.el).addClass(this.elementType + "-audio");

            // // Autoplay restricted for items
            // this.canAutoplay = false;
            // this.autoplayOnce = false;
            if (Adapt.audio.autoPlayGlobal) {
                this.canAutoplay = true;
            } else {
                this.canAutoplay = false;
            }

            // Autoplay once
            if (Adapt.audio.autoPlayOnceGlobal || this.model.get("_audio")._autoPlayOnce) {
                this.autoplayOnce = true;
            } else {
                this.autoplayOnce = false;
            }

            //overriding global autoplay for items
            if (this.model.get("_audio")._autoplay) {
                this.canAutoplay = true;
            } else {
                this.canAutoplay = false;
            }

            this.canAutoplayWhenOnScreen = this.model.get("_audio")._autoplayWhenOnScreen

            // Set audio file
            this.setAudioFile();

            // Set clip ID
            // Adapt.audio.audioClip[this.audioChannel].newID = this.elementId;

            // Set listener for when clip ends
            // $(Adapt.audio.audioClip[this.audioChannel]).on('ended', _.bind(this.onAudioEnded, this));

            _.defer(_.bind(function () {
                this.postRender();
            }, this));
        },

        postRender: function () {
            this.updateToggle();
        },

        setupAudio: function () {
            _.delay(_.bind(function () {
                this.popupIsOpen = false;
                this.$el.on('onscreen', _.bind(this.onscreen, this));
            }, this), 500);
        },

        updateAutoplay: function (AutoplayGlobal) {
            if (this.model.get("_audio")._autoplay) {
                this.canAutoplay = Adapt.audio.autoPlayGlobal;
            }
        },

        onscreen: function (event, measurements) {

            if (this.popupIsOpen) return;
            this.updateAutoplay();
            var visible = $(event.currentTarget).is(":visible");
            var isOnscreenX = measurements.percentInviewHorizontal == 100;
            var isOnscreen = measurements.onscreen;

            var elementTopOnscreenY = measurements.percentFromTop < Adapt.audio.triggerPosition && measurements.percentFromTop > 0;
            var elementBottomOnscreenY = measurements.percentFromTop < Adapt.audio.triggerPosition && measurements.percentFromBottom < (100 - Adapt.audio.triggerPosition);

            var isOnscreenY = elementTopOnscreenY || elementBottomOnscreenY;

            // Check for element coming on screen
            if (visible && isOnscreen && this.canAutoplay && ((isOnscreenY && isOnscreenX) || this.canAutoplayWhenOnScreen) && !this.onscreenTriggered && !this.isAnimating) {
                // Check if audio is set to on
                if (Adapt.audio.audioClip[this.audioChannel].status == 1) {
                    this.setAudioFile();

                    // Check for component items
                    if (this.elementType === 'component' && !this.model.get('_isQuestionType') && this.model.get('_children') && this.model.get('_children').length) {
                        var itemIndex = this.getActiveItemIndex();
                        var currentItem = this.model.get('_items')[itemIndex];

                        // Check for tiles component
                        if (this.model.get('_component') == "tiles" && itemIndex != null) {
                            if (itemIndex == 0 || itemIndex > 0) {
                                this.audioFile = currentItem._audio.src ? currentItem._audio.src : currentItem._audio._src;
                            }
                        } else {
                            if (itemIndex > 0) {
                                this.audioFile = currentItem._audio.src ? currentItem._audio.src : currentItem._audio._src;
                            }
                        }
                    }

                    // Adapt.trigger('audio:playAudio', this.audioFile, this.elementId, this.audioChannel);
                    this.playAudio($("#" + this.elementId));
                }
                // Set to false to stop autoplay when onscreen again
                if (this.autoplayOnce) {
                    this.canAutoplay = false;
                }
                // Set to true to stop onscreen looping
                this.onscreenTriggered = true;
            }

            // Check when element is off screen
            if (this.canAutoplayWhenOnScreen) {
                if (!visible && !isOnscreen) {
                    this.onscreenTriggered = false;
                    Adapt.trigger('audio:onscreenOff', this.elementId, this.audioChannel);
                }
            }
            else if (visible && (!isOnscreenY || !isOnscreenX)) {
                this.onscreenTriggered = false;
                Adapt.trigger('audio:onscreenOff', this.elementId, this.audioChannel);
            }
        },

        setAudioFile: function () {
            // Set audio file based on the device size
            if (Adapt.device.screenSize === 'large') {
                try {
                    this.audioFile = this.model.get("_audio")._media.desktop;
                } catch (e) {
                    console.log('An error has occured loading audio');
                }
            } else {
                try {
                    this.audioFile = this.model.get("_audio")._media.desktop;
                } catch (e) {
                    console.log('An error has occured loading audio');
                }
            }
        },

        toggleAudio: function (event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation()
            }
            this.setAudioFile();
            Adapt.audio.audioClip[this.audioChannel].onscreenID = "";
            if ($(event.currentTarget).hasClass('playing')) {
                this.pauseAudio($(event.currentTarget));
            } else {
                this.playAudio($(event.currentTarget));
            }
        },

        playAudio: function ($target) {
            // iOS requires direct user interaction on a button to enable autoplay
            // Re-use code from main adapt-audio.js playAudio() function

            Adapt.trigger("media:stop");

            // Stop audio
            Adapt.audio.audioClip[this.audioChannel].pause();
            Adapt.audio.audioClip[this.audioChannel].isPlaying = false;

            // Update previous player if there is one
            if (Adapt.audio.audioClip[this.audioChannel].playingID) {
                $('#' + Adapt.audio.audioClip[this.audioChannel].playingID).removeClass(Adapt.audio.iconPause);
                $('#' + Adapt.audio.audioClip[this.audioChannel].playingID).addClass(Adapt.audio.iconPlay);
                $('#' + Adapt.audio.audioClip[this.audioChannel].playingID).removeClass('playing');
            }

            $target.removeClass(Adapt.audio.iconPlay);
            $target.addClass(Adapt.audio.iconPause);
            $target.addClass('playing');

            Adapt.audio.audioClip[this.audioChannel].prevID = Adapt.audio.audioClip[this.audioChannel].playingID;
            Adapt.audio.audioClip[this.audioChannel].src = this.audioFile;

            // Check for component items
            if (this.elementType === 'component' && !this.model.get('_isQuestionType') && this.model.get('_children') && this.model.get('_children').length) {
                var itemIndex = this.getActiveItemIndex();
                var currentItem = this.model.get('_items')[itemIndex];

                // Check for tiles component
                if (this.model.get('_component') == "tiles" && itemIndex != null) {
                    if (itemIndex == 0 || itemIndex > 0) {
                        Adapt.audio.audioClip[this.audioChannel].src = currentItem._audio.src ? currentItem._audio.src : currentItem._audio._src;
                    }
                } else {
                    if (itemIndex > 0) {
                        Adapt.audio.audioClip[this.audioChannel].src = currentItem._audio.src ? currentItem._audio.src : currentItem._audio._src;
                    }
                }
            }

            Adapt.audio.audioClip[this.audioChannel].newID = this.elementId;

            if (Adapt.audio.pauseStopAction == "pause") {
                Adapt.audio.audioClip[this.audioChannel].play(this.pausedTime);
                $target.attr('aria-label', $.a11y_normalize(Adapt.audio.pauseAriaLabel));
            } else {
                Adapt.audio.audioClip[this.audioChannel].play();
                $target.attr('aria-label', $.a11y_normalize(Adapt.audio.stopAriaLabel));
            }

            Adapt.audio.audioClip[this.audioChannel].onscreenID = this.elementId;
            Adapt.audio.audioClip[this.audioChannel].playingID = Adapt.audio.audioClip[this.audioChannel].newID;
            Adapt.audio.audioClip[this.audioChannel].isPlaying = true;
        },

        pauseAudio: function ($target) {
            if (Adapt.audio.pauseStopAction == "pause") {
                this.pausedTime = Adapt.audio.audioClip[this.audioChannel].currentTime;
                Adapt.audio.audioClip[this.audioChannel].pause();
                Adapt.audio.audioClip[this.audioChannel].isPlaying = false;
                $target.removeClass(Adapt.audio.iconPause);
                $target.addClass(Adapt.audio.iconPlay);
                $target.removeClass('playing');
            } else {
                Adapt.trigger('audio:pauseAudio', this.audioChannel);
            }
            $target.attr('aria-label', $.a11y_normalize(Adapt.audio.playAriaLabel));
        },

        updateToggle: function () {
            if (Adapt.audio.audioClip[this.audioChannel].status == 1 && this.model.get('_audio')._showControls == true) {
                this.$('.audio-inner button').show();

                var outerWidth = this.$('.audio-toggle').outerWidth();
                var elementWidth = this.model.get("itemElement").outerWidth();
                var padding = outerWidth - this.$('.audio-toggle').width();
                var maxWidth = (elementWidth - outerWidth) - padding;

                // Set width on elements title or body
                if (this.model.get('displayTitle') == "") {
                    $('.' + this.elementId).find('.' + this.elementType + '-body-inner').css("max-width", maxWidth);
                } else {
                    $('.' + this.elementId).find('.' + this.elementType + '-title-inner').css("max-width", maxWidth);
                }

            } else {
                this.$('.audio-inner button').hide();
                // Reset
                $('.' + this.elementId).find('.' + this.elementType + '-body-inner').css("max-width", "");
                $('.' + this.elementId).find('.' + this.elementType + '-title-inner').css("max-width", "");
            }
        }

    });

    return AudioItemControlsView;
})