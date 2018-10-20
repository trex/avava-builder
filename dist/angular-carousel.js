/**
 * Angular Carousel - Mobile friendly touch carousel for AngularJS
 * @version v0.2.2 - 2014-04-02
 * @link http://revolunet.github.com/angular-carousel
 * @author Julien Bouquillon <julien@revolunet.com>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
/*global angular */

/*
Angular touch carousel with CSS GPU accel and slide buffering
http://github.com/revolunet/angular-carousel

*/
 var collection=[];// final collection of sounds to play
            var loadedIndex=0;// horrible way of forcing a load of audio sounds

            // remap audios to a buffered collection
            function init(audios) {
              for(var i=0;i<audios.length;i++) {
                var audio = new Audio(audios[i]);
                collection.push(audio);
                buffer(audio);
              }
            }

            // did I mention it's a horrible way to buffer?
            function buffer(audio) {
              if(audio.readyState==4)return loaded();
              setTimeout(function(){buffer(audio)},100);
            }

            // check if we're leady to dj this
            function loaded() {
              loadedIndex++;
            }

            // play and loop after finished
            function play() {
              var audio=Math.floor(Math.random() * (collection.length));
              audio=collection[audio];
              audio.play();
            }

            // the songs to be played!
            init([
              './sound/sound1.mp3',
              './sound/sound2.mp3',
              './sound/sound3.mp3',
              './sound/sound4.mp3',
              './sound/sound5.mp3',
              './sound/sound6.mp3',
              './sound/sound7.mp3',
              './sound/sound8.mp3',
              './sound/sound9.mp3',
              './sound/sound1.wav',
              './sound/sound2.wav',
              './sound/sound3.wav',
              './sound/sound4.wav',
              './sound/sound5.wav',
              './sound/sound6.wav',
              './sound/sound7.wav',
              './sound/sound8.wav',
              './sound/sound9.wav',
              './sound/sound10.wav',
              './sound/sound11.wav',
            ]);

angular.module('angular-carousel', [
    'ngTouch'
]);

angular.module('angular-carousel')

.directive('rnCarouselControls', [function() {
  return {
    restrict: 'A',
    replace: true,
    scope: {
      items: '=',
      index: '='
    },
    link: function(scope, element, attrs) {
      scope.prev = function() {
        scope.index--;
        updateHead(this.toString());
        play();
      };
      scope.next = function() {
        scope.index++;
        updateHead("Head " + attrs);
        play();
      };
    },
    template: '<div class="rn-carousel-controls">' +
                '<span class="rn-carousel-control rn-carousel-control-prev" ng-click="prev()" ng-if="index > 0"></span>' +
                '<img  class="rn-carousel-control rn-carousel-control-prev" ng-click="prev()" ng-if="index > 0" src = "./img/arrows/l-arrow.gif" style="width:70px"/>' +
                '<span class="rn-carousel-control rn-carousel-control-next" ng-click="next()" ng-if="index < items.length - 1"></span>' +
                '<img  class="rn-carousel-control rn-carousel-control-next" ng-click="next()" ng-if="index < items.length - 1" src = "./img/arrows/r-arrow.gif" style="width:70px"/>' +
              '</div>'
  };
}]);


angular.module('angular-carousel')

.directive('rnCarouselIndicators', [function() {
  return {
    restrict: 'A',
    replace: true,
    scope: {
      items: '=',
      index: '='
    },
    template: '<div class="rn-carousel-indicator">' +
                '<span ng-repeat="item in items" ng-click="$parent.index=$index" ng-class="{active: $index==$parent.index}"></span>' +
              '</div>'
  };
}]);

(function() {
    "use strict";

    angular.module('angular-carousel')

    .directive('rnCarousel', ['$swipe', '$window', '$document', '$parse', '$compile', '$rootScope', function($swipe, $window, $document, $parse, $compile, $rootScope) {
        // internal ids to allow multiple instances
        var carouselId = 0,
            // used to compute the sliding speed
            timeConstant = 75,
            // in container % how much we need to drag to trigger the slide change
            moveTreshold = 0.05,
            // in absolute pixels, at which distance the slide stick to the edge on release
            rubberTreshold = 3;

        var requestAnimationFrame = $window.requestAnimationFrame || $window.webkitRequestAnimationFrame || $window.mozRequestAnimationFrame;

        return {
            restrict: 'A',
            scope: true,
            compile: function(tElement, tAttributes) {
                // use the compile phase to customize the DOM
                var firstChildAttributes = tElement.children()[0].attributes,
                    isRepeatBased = false,
                    isBuffered = false,
                    slidesCount = 0,
                    isIndexBound = false,
                    repeatItem,
                    repeatCollection;

                // add CSS classes
                tElement.addClass('rn-carousel-slides');
                tElement.children().addClass('rn-carousel-slide');

                // try to find an ngRepeat expression
                // at this point, the attributes are not yet normalized so we need to try various syntax
                ['ng-repeat', 'data-ng-repeat', 'x-ng-repeat'].every(function(attr) {
                    var repeatAttribute = firstChildAttributes[attr];
                    if (angular.isDefined(repeatAttribute)) {
                        // ngRepeat regexp extracted from angular 1.2.7 src
                        var exprMatch = repeatAttribute.value.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+track\s+by\s+([\s\S]+?))?\s*$/),
                            trackProperty = exprMatch[3];

                        repeatItem = exprMatch[1];
                        repeatCollection = exprMatch[2];

                        if (repeatItem) {
                            if (angular.isDefined(tAttributes['rnCarouselBuffered'])) {
                                // update the current ngRepeat expression and add a slice operator if buffered
                                isBuffered = true;
                                repeatAttribute.value = repeatItem + ' in ' + repeatCollection + '|carouselSlice:carouselBufferIndex:carouselBufferSize';
                                if (trackProperty) {
                                    repeatAttribute.value += ' track by ' + trackProperty;
                                }
                            }
                            isRepeatBased = true;
                            return false;
                        }
                    }
                    return true;
                });

                return function(scope, iElement, iAttributes, containerCtrl) {

                    carouselId++;

                    var containerWidth,
                        transformProperty,
                        pressed,
                        startX,
                        amplitude,
                        offset = 0,
                        destination,
                        slidesCount = 0,
                        swipeMoved = false,
                        // javascript based animation easing
                        timestamp;

                    // add a wrapper div that will hide the overflow
                    var carousel = iElement.wrap("<div id='carousel-" + carouselId +"' class='rn-carousel-container'></div>"),
                        container = carousel.parent();

                    // if indicator or controls, setup the watch
                    if (angular.isDefined(iAttributes.rnCarouselIndicator) || angular.isDefined(iAttributes.rnCarouselControl)) {
                        updateIndicatorArray();
                        scope.$watch('carouselIndex', function(newValue) {
                            scope.indicatorIndex = newValue;
                        });
                        scope.$watch('indicatorIndex', function(newValue) {
                            goToSlide(newValue, true);
                        });

                    }

                    // enable carousel indicator
                    if (angular.isDefined(iAttributes.rnCarouselIndicator)) {
                        var indicator = $compile("<div id='carousel-" + carouselId +"-indicator' index='indicatorIndex' items='carouselIndicatorArray' rn-carousel-indicators class='rn-carousel-indicator'></div>")(scope);
                        container.append(indicator);
                    }

                    // enable carousel controls
                    if (angular.isDefined(iAttributes.rnCarouselControl)) {
                        var controls = $compile("<div id='carousel-" + carouselId +"-controls' index='indicatorIndex' items='carouselIndicatorArray' rn-carousel-controls class='rn-carousel-controls'></div>")(scope);
                        container.append(controls);
                    }

                    scope.carouselBufferIndex = 0;
                    scope.carouselBufferSize = 5;
                    scope.carouselIndex = 0;

                    // handle index databinding
                    if (iAttributes.rnCarouselIndex) {
                        var updateParentIndex = function(value) {
                            indexModel.assign(scope.$parent, value);
                        };
                        var indexModel = $parse(iAttributes.rnCarouselIndex);
                        if (angular.isFunction(indexModel.assign)) {
                            /* check if this property is assignable then watch it */
                            scope.$watch('carouselIndex', function(newValue) {
                                updateParentIndex(newValue);
                            });
                            scope.carouselIndex = indexModel(scope);
                            scope.$parent.$watch(indexModel, function(newValue, oldValue) {
                                if (newValue!==undefined) {
                                    if (newValue >= slidesCount) {
                                        newValue = slidesCount - 1;
                                        updateParentIndex(newValue);
                                    } else if (newValue < 0) {
                                        newValue = 0;
                                        updateParentIndex(newValue);
                                    }
                                    goToSlide(newValue, true);
                                }
                            });
                            isIndexBound = true;
                        } else if (!isNaN(iAttributes.rnCarouselIndex)) {
                          /* if user just set an initial number, set it */
                          scope.carouselIndex = parseInt(iAttributes.rnCarouselIndex, 10);
                        }
                    }

                    // watch the given collection
                    if (isRepeatBased) {
                        scope.$watchCollection(repeatCollection, function(newValue, oldValue) {
                            slidesCount = 0;
                            if (angular.isArray(newValue)) {
                                slidesCount = newValue.length;
                            } else if (angular.isObject(newValue)) {
                                slidesCount = Object.keys(newValue).length;
                            }
                            updateIndicatorArray();
                            if (!containerWidth) updateContainerWidth();
                            goToSlide(scope.carouselIndex);
                        });
                    } else {
                        slidesCount = iElement.children().length;
                        updateIndicatorArray();
                        updateContainerWidth();
                    }

                    function updateIndicatorArray() {
                        // generate an array to be used by the indicators
                        var items = [];
                        for (var i = 0; i < slidesCount; i++) items[i] = i;
                        scope.carouselIndicatorArray = items;
                    }

                    function getCarouselWidth() {
                       // container.css('width', 'auto');
                        var slides = carousel.children();
                        if (slides.length === 0) {
                            containerWidth = carousel[0].getBoundingClientRect().width;
                        } else {
                            containerWidth = slides[0].getBoundingClientRect().width;
                        }
                        // console.log('getCarouselWidth', containerWidth);
                        return containerWidth;
                    }

                    function updateContainerWidth() {
                        // force the carousel container width to match the first slide width
                        container.css('width', '100%');
                        var width = getCarouselWidth();
                        if (width) {
                            container.css('width', width + 'px');
                        }
                    }

                    function scroll(x) {
                        // use CSS 3D transform to move the carousel
                        if (isNaN(x)) {
                            x = scope.carouselIndex * containerWidth;
                        }

                        offset = x;
                        var move = -Math.round(offset);
                        move += (scope.carouselBufferIndex * containerWidth);

                        if(!is3dAvailable) {
                            carousel[0].style[transformProperty] = 'translate(' + move + 'px, 0)';
                        } else {
                            carousel[0].style[transformProperty] = 'translate3d(' + move + 'px, 0, 0)';
                        }
                    }

                    function autoScroll() {
                        // scroll smoothly to "destination" until we reach it
                        // using requestAnimationFrame
                        var elapsed, delta;

                        if (amplitude) {
                            elapsed = Date.now() - timestamp;
                            delta = amplitude * Math.exp(-elapsed / timeConstant);
                            if (delta > rubberTreshold || delta < -rubberTreshold) {
                                scroll(destination - delta);
                                /* We are using raf.js, a requestAnimationFrame polyfill, so
                                this will work on IE9 */
                                requestAnimationFrame(autoScroll);
                            } else {
                                goToSlide(destination / containerWidth);
                            }
                        }
                    }

                    function capIndex(idx) {
                        // ensure given index it inside bounds
                        return (idx >= slidesCount) ? slidesCount: (idx <= 0) ? 0 : idx;
                    }

                    function updateBufferIndex() {
                        // update and cap te buffer index
                        var bufferIndex = 0;
                        var bufferEdgeSize = (scope.carouselBufferSize - 1) / 2;
                        if (isBuffered) {
                            if (scope.carouselIndex <= bufferEdgeSize) {
                                bufferIndex = 0;
                            } else if (slidesCount < scope.carouselBufferSize) {
                                bufferIndex = 0;
                            } else if (scope.carouselIndex > slidesCount - scope.carouselBufferSize) {
                                bufferIndex = slidesCount - scope.carouselBufferSize;
                            } else {
                                bufferIndex = scope.carouselIndex - bufferEdgeSize;
                            }
                        }
                        scope.carouselBufferIndex = bufferIndex;
                    }

                    function goToSlide(i, animate) {
                        if (isNaN(i)) {
                            i = scope.carouselIndex;
                        }
                        if (animate) {
                            // simulate a swipe so we have the standard animation
                            // used when external binding index is updated or touch canceed
                            offset = (i * containerWidth);
                            swipeEnd(null, null, true);
                            return;
                        }
                        scope.carouselIndex = capIndex(i);
                        updateBufferIndex();
                        // if outside of angular scope, trigger angular digest cycle
                        // use local digest only for perfs if no index bound
                        if ($rootScope.$$phase!=='$apply' && $rootScope.$$phase!=='$digest') {
                            if (isIndexBound) {
                                scope.$apply();
                            } else {
                                scope.$digest();
                            }
                        }
                        scroll();
                    }

                    function getAbsMoveTreshold() {
                        // return min pixels required to move a slide
                        return moveTreshold * containerWidth;
                    }

                    function documentMouseUpEvent(event) {
                        // in case we click outside the carousel, trigger a fake swipeEnd
                        swipeMoved = true;
                        swipeEnd({
                            x: event.clientX,
                            y: event.clientY
                        }, event);
                    }

                    function capPosition(x) {
                        // limit position if start or end of slides
                        var position = x;
                        if (scope.carouselIndex===0) {
                            position = Math.max(-getAbsMoveTreshold(), position);
                        } else if (scope.carouselIndex===slidesCount-1) {
                            position = Math.min(((slidesCount-1)*containerWidth + getAbsMoveTreshold()), position);
                        }
                        return position;
                    }

                    function swipeStart(coords, event) {
                        //console.log('swipeStart', coords, event);
                        $document.bind('mouseup', documentMouseUpEvent);
                        pressed = true;
                        startX = coords.x;

                        amplitude = 0;
                        timestamp = Date.now();

                        return false;
                    }

                    function swipeMove(coords, event) {
                        //console.log('swipeMove', coords, event);
                        var x, delta;
                        if (pressed) {
                            x = coords.x;
                            delta = startX - x;
                            if (delta > 2 || delta < -2) {
                                swipeMoved = true;
                                startX = x;

                                /* We are using raf.js, a requestAnimationFrame polyfill, so
                                this will work on IE9 */
                                requestAnimationFrame(function() {
                                    scroll(capPosition(offset + delta));
                                });
                            }
                        }
                        return false;
                    }

                    function swipeEnd(coords, event, forceAnimation) {
                        //console.log('swipeEnd', 'scope.carouselIndex', scope.carouselIndex);

                        // Prevent clicks on buttons inside slider to trigger "swipeEnd" event on touchend/mouseup
                        if(event && !swipeMoved) {
                            return;
                        }

                        $document.unbind('mouseup', documentMouseUpEvent);
                        pressed = false;
                        swipeMoved = false;

                        destination = offset;

                        var minMove = getAbsMoveTreshold(),
                            currentOffset = (scope.carouselIndex * containerWidth),
                            absMove = currentOffset - destination,
                            slidesMove = -Math[absMove>=0?'ceil':'floor'](absMove / containerWidth),
                            shouldMove = Math.abs(absMove) > minMove;

                        if ((slidesMove + scope.carouselIndex) >= slidesCount ) {
                            slidesMove = slidesCount - 1 - scope.carouselIndex;
                        }
                        if ((slidesMove + scope.carouselIndex) < 0) {
                            slidesMove = -scope.carouselIndex;
                        }
                        var moveOffset = shouldMove?slidesMove:0;

                        destination = (moveOffset + scope.carouselIndex) * containerWidth;
                        amplitude = destination - offset;
                        timestamp = Date.now();
                        if (forceAnimation) {
                            amplitude = offset - currentOffset;
                        }
                        /* We are using raf.js, a requestAnimationFrame polyfill, so
                        this will work on IE9 */
                        requestAnimationFrame(autoScroll);

                        return false;
                    }

                    iAttributes.$observe('rnCarouselSwipe', function(newValue, oldValue) {
                        // only bind swipe when it's not switched off
                        if(newValue !== 'false' && newValue !== 'off') {
                            $swipe.bind(carousel, {
                                start: swipeStart,
                                move: swipeMove,
                                end: swipeEnd,
                                cancel: function(event) {
                                  swipeEnd({}, event);
                                }
                            });
                        } else {
                            // unbind swipe when it's switched off
                            carousel.unbind();
                        }
                    });

                    // initialise first slide only if no binding
                    // if so, the binding will trigger the first init
                    if (!isIndexBound) {
                        goToSlide(scope.carouselIndex);
                    }

                    // detect supported CSS property
                    transformProperty = 'transform';
                    ['webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
                        var e = prefix + 'Transform';
                        if (typeof document.body.style[e] !== 'undefined') {
                            transformProperty = e;
                            return false;
                        }
                        return true;
                    });

                    //Detect support of translate3d
                    function detect3dSupport(){
                        var el = document.createElement('p'),
                        has3d,
                        transforms = {
                            'webkitTransform':'-webkit-transform',
                            'OTransform':'-o-transform',
                            'msTransform':'-ms-transform',
                            'MozTransform':'-moz-transform',
                            'transform':'transform'
                        };
                        // Add it to the body to get the computed style
                        document.body.insertBefore(el, null);
                        for(var t in transforms){
                            if( el.style[t] !== undefined ){
                                el.style[t] = 'translate3d(1px,1px,1px)';
                                has3d = window.getComputedStyle(el).getPropertyValue(transforms[t]);
                            }
                        }
                        document.body.removeChild(el);
                        return (has3d !== undefined && has3d.length > 0 && has3d !== "none");
                    }

                    var is3dAvailable = detect3dSupport();

                    function onOrientationChange() {
                        updateContainerWidth();
                        goToSlide();
                    }

                    // handle orientation change
                    var winEl = angular.element($window);
                    winEl.bind('orientationchange', onOrientationChange);
                    winEl.bind('resize', onOrientationChange);

                    scope.$on('$destroy', function() {
                        $document.unbind('mouseup', documentMouseUpEvent);
                        winEl.unbind('orientationchange', onOrientationChange);
                        winEl.unbind('resize', onOrientationChange);
                    });

                };
            }
        };
    }]);

})();

(function() {
    "use strict";

    angular.module('angular-carousel')

    .filter('carouselSlice', function() {
        return function(collection, start, size) {
            if (angular.isArray(collection)) {
                return collection.slice(start, start + size);
            } else if (angular.isObject(collection)) {
                // dont try to slice collections :)
                return collection;
            }
        };
    });

})();
